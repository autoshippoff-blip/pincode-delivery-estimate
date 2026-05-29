import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const STATES_TO_TEST = [
  'Tamil Nadu',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Delhi',
  'Assam',
  'Rajasthan',
];

async function test() {
  try {
    const totalCount = await prisma.pincode.count();
    console.log(`Total Pincodes in Database: ${totalCount}`);
    
    console.log('\nTesting random pincodes for key states:');
    console.log('--------------------------------------------------');
    
    for (const stateName of STATES_TO_TEST) {
      // Find a pincode for the state
      const pincode = await prisma.pincode.findFirst({
        where: {
          state: {
            equals: stateName,
            mode: 'insensitive',
          },
        },
      });
      
      if (pincode) {
        console.log(`State: ${stateName.padEnd(15)} | Pincode: ${pincode.pincode} | Office: ${pincode.officeName} | Region: ${pincode.region} | Lat/Lng: ${pincode.latitude}/${pincode.longitude}`);
      } else {
        console.warn(`❌ No pincode found for state: ${stateName}`);
      }
    }
  } catch (err) {
    console.error('Error during checks:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
