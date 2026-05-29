import { PrismaClient } from '@prisma/client';
import * as Papa from 'papaparse';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

const STATE_REGION_MAP: Record<string, string> = {
  'tamil nadu': 'south',
  'karnataka': 'south',
  'kerala': 'south',
  'andhra pradesh': 'south',
  'telangana': 'south',
  'puducherry': 'south',
  'lakshadweep': 'south',
  'andaman & nicobar islands': 'south',
  'andaman and nicobar islands': 'south',
  
  'maharashtra': 'west',
  'gujarat': 'west',
  'goa': 'west',
  'dadra and nagar haveli': 'west',
  'daman and diu': 'west',
  'dadra and nagar haveli and daman and diu': 'west',
  
  'madhya pradesh': 'central',
  'chhattisgarh': 'central',
  'rajasthan': 'central',
  
  'delhi': 'north',
  'uttar pradesh': 'north',
  'haryana': 'north',
  'punjab': 'north',
  'himachal pradesh': 'north',
  'uttarakhand': 'north',
  'jammu and kashmir': 'north',
  'jammu & kashmir': 'north',
  'chandigarh': 'north',
  'ladakh': 'north',
  
  'west bengal': 'east',
  'odisha': 'east',
  'jharkhand': 'east',
  'bihar': 'east',
  
  'assam': 'northeast',
  'arunachal pradesh': 'northeast',
  'manipur': 'northeast',
  'meghalaya': 'northeast',
  'mizoram': 'northeast',
  'nagaland': 'northeast',
  'sikkim': 'northeast',
  'tripura': 'northeast',
};

interface CsvRow {
  Pincode?: string;
  pincode?: string;
  OfficeName?: string;
  PostOfficeName?: string;
  officeName?: string;
  officename?: string;
  office_name?: string;
  District?: string;
  DistrictsName?: string;
  districtName?: string;
  districtname?: string;
  district?: string;
  StateName?: string;
  State?: string;
  stateName?: string;
  statename?: string;
  state?: string;
  City?: string;
  Latitude?: string;
  Longitude?: string;
}

async function main() {
  const csvUrl = 'https://raw.githubusercontent.com/dropdevrahul/pincodes-india/master/pincode.csv';
  console.log(`Fetching pincode data from: ${csvUrl}`);
  
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }
    
    const csvData = await response.text();
    console.log('CSV downloaded successfully. Parsing CSV data...');
    
    const parsed = Papa.parse<CsvRow>(csvData, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (parsed.errors.length > 0) {
      console.warn(`Encountered ${parsed.errors.length} errors during CSV parsing. First error:`, parsed.errors[0]);
    }
    
    const rows = parsed.data;
    console.log(`Total rows parsed from CSV: ${rows.length}`);
    if (rows.length > 0) {
      console.log('First row parsed:', rows[0]);
      console.log('Keys of first row:', Object.keys(rows[0]));
    }
    
    const uniquePincodes = new Map<string, any>();
    
    for (const row of rows) {
      // Normalize columns since header names might vary
      const pincode = (row.Pincode || row.pincode || '').trim();
      const officeName = (row.OfficeName || row.PostOfficeName || row.officeName || row.officename || row.office_name || '').trim();
      const district = (row.District || row.DistrictsName || row.districtName || row.districtname || row.district || '').trim();
      const state = (row.StateName || row.State || row.stateName || row.statename || row.state || '').trim();
      
      const latStr = row.Latitude || '';
      const lngStr = row.Longitude || '';
      const latitude = latStr ? parseFloat(latStr) : null;
      const longitude = lngStr ? parseFloat(lngStr) : null;
      
      // Validate pincode format (6-digit)
      if (!/^\d{6}$/.test(pincode)) {
        continue;
      }
      
      // Map state to region
      const stateLower = state.toLowerCase();
      let region = STATE_REGION_MAP[stateLower];
      if (!region) {
        // Fallback checks
        if (stateLower.includes('bengal')) region = 'east';
        else if (stateLower.includes('kashmir') || stateLower.includes('jammu')) region = 'north';
        else if (stateLower.includes('nicobar') || stateLower.includes('andaman')) region = 'south';
        else region = 'central'; // Default fallback
      }
      
      // We only keep the first occurrence of each unique pincode to satisfy primary key
      if (!uniquePincodes.has(pincode)) {
        uniquePincodes.set(pincode, {
          pincode,
          officeName: officeName || 'Post Office',
          district: district || 'Unknown',
          state: state || 'Unknown',
          region,
          latitude: latitude && !isNaN(latitude) ? latitude : null,
          longitude: longitude && !isNaN(longitude) ? longitude : null,
        });
      }
    }
    
    const pincodesToInsert = Array.from(uniquePincodes.values());
    console.log(`Found ${pincodesToInsert.length} unique valid pincodes.`);
    
    console.log('Clearing existing pincodes from database...');
    await prisma.pincode.deleteMany();
    
    console.log('Seeding database in chunks of 1000...');
    const chunkSize = 1000;
    let seededCount = 0;
    
    for (let i = 0; i < pincodesToInsert.length; i += chunkSize) {
      const chunk = pincodesToInsert.slice(i, i + chunkSize);
      
      // We use createMany with skipDuplicates to avoid crashing on duplicate conflicts
      await prisma.pincode.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      
      seededCount += chunk.length;
      console.log(`Seeded ${seededCount}/${pincodesToInsert.length} pincodes...`);
    }
    
    console.log('Pincode seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
