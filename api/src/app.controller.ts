import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { CacheService } from './cache/cache.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('diagnostics/db-check')
  async dbCheck() {
    try {
      const tenants = await this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          apiKey: true,
          isActive: true,
        }
      });
      const maskedTenants = tenants.map(t => ({
        id: t.id,
        name: t.name,
        isActive: t.isActive,
        apiKeyLength: t.apiKey.length,
        apiKeyMasked: t.apiKey.length > 8 ? t.apiKey.substring(0, 4) + '...' + t.apiKey.substring(t.apiKey.length - 4) : '***',
      }));
      return {
        success: true,
        database: 'connected',
        tenantsCount: tenants.length,
        tenants: maskedTenants,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
      };
    }
  }

  @Get('diagnostics/seed')
  async seedDb() {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
    };

    try {
      log('Starting programmatic database seeding...');
      
      const tenantsData = [
        {
          apiKey: 'demo_merchant_key',
          name: 'Demo Merchant Widget',
          allowedOrigins: ['*'],
          etaMode: 'STATIC_RULES' as any,
          overrides: [
            { region: 'south', minDays: 2, maxDays: 3 },
          ],
          warehouse: {
            name: 'Demo Bengaluru Hub',
            pincode: '560001',
            city: 'Bengaluru',
            state: 'Karnataka',
          },
        },
        {
          apiKey: 'test_merchant_api_key',
          name: 'Test Merchant SaaS',
          allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
          etaMode: 'STATIC_RULES' as any,
          overrides: [
            { region: 'south', minDays: 1, maxDays: 2 },
            { region: 'west', minDays: 2, maxDays: 3 },
          ],
          warehouse: {
            name: 'Chennai Central Hub',
            pincode: '600001',
            city: 'Chennai',
            state: 'Tamil Nadu',
          },
        }
      ];

      for (const data of tenantsData) {
        const tenant = await this.prisma.tenant.upsert({
          where: { apiKey: data.apiKey },
          update: {
            name: data.name,
            allowedOrigins: data.allowedOrigins,
            etaMode: data.etaMode,
          },
          create: {
            name: data.name,
            apiKey: data.apiKey,
            allowedOrigins: data.allowedOrigins,
            etaMode: data.etaMode,
          },
        });

        log(`Tenant created/updated: ${tenant.name} (${tenant.id})`);

        await this.prisma.deliveryRule.deleteMany({
          where: { tenantId: tenant.id },
        });

        for (const override of data.overrides) {
          const rule = await this.prisma.deliveryRule.create({
            data: {
              tenantId: tenant.id,
              region: override.region,
              minDays: override.minDays,
              maxDays: override.maxDays,
              isActive: true,
            },
          });
          log(` - Created delivery rule override for ${rule.region}: ${rule.minDays}-${rule.maxDays} Days`);
        }

        await this.prisma.warehouse.deleteMany({
          where: { tenantId: tenant.id },
        });

        const warehouse = await this.prisma.warehouse.create({
          data: {
            tenantId: tenant.id,
            name: data.warehouse.name,
            pincode: data.warehouse.pincode,
            city: data.warehouse.city,
            state: data.warehouse.state,
          },
        });
        log(` - Created warehouse: ${warehouse.name} at pincode ${warehouse.pincode}`);
      }

      log('Seeding completed successfully!');
      return {
        success: true,
        logs,
      };
    } catch (e: any) {
      log(`Error: ${e.message}`);
      return {
        success: false,
        logs,
        error: e.message,
      };
    }
  }

  @Get('diagnostics/seed-pincodes')
  async seedPincodes() {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
    };

    const csvUrl = 'https://raw.githubusercontent.com/dropdevrahul/pincodes-india/master/pincode.csv';
    log(`Fetching pincode data from: ${csvUrl}`);

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

    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.statusText}`);
      }
      
      const csvData = await response.text();
      log('CSV downloaded successfully. Parsing CSV...');
      
      const Papa = require('papaparse');
      const parsed = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
      });

      const rows = parsed.data;
      log(`Total rows parsed from CSV: ${rows.length}`);
      
      const uniquePincodes = new Map<string, any>();
      
      for (const row of rows) {
        const pincode = (row.Pincode || row.pincode || '').trim();
        const officeName = (row.OfficeName || row.PostOfficeName || row.officeName || row.officename || row.office_name || '').trim();
        const district = (row.District || row.DistrictsName || row.districtName || row.districtname || row.district || '').trim();
        const state = (row.StateName || row.State || row.stateName || row.statename || row.state || '').trim();
        
        const latStr = row.Latitude || '';
        const lngStr = row.Longitude || '';
        const latitude = latStr ? parseFloat(latStr) : null;
        const longitude = lngStr ? parseFloat(lngStr) : null;
        
        if (!/^\d{6}$/.test(pincode)) {
          continue;
        }
        
        const stateLower = state.toLowerCase();
        let region = STATE_REGION_MAP[stateLower];
        if (!region) {
          if (stateLower.includes('bengal')) region = 'east';
          else if (stateLower.includes('kashmir') || stateLower.includes('jammu')) region = 'north';
          else if (stateLower.includes('nicobar') || stateLower.includes('andaman')) region = 'south';
          else region = 'central';
        }
        
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
      log(`Found ${pincodesToInsert.length} unique valid pincodes.`);
      
      log('Clearing existing pincodes from database...');
      await this.prisma.pincode.deleteMany();
      
      log('Seeding database in chunks of 1000...');
      const chunkSize = 1000;
      let seededCount = 0;
      
      for (let i = 0; i < pincodesToInsert.length; i += chunkSize) {
        const chunk = pincodesToInsert.slice(i, i + chunkSize);
        await this.prisma.pincode.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        seededCount += chunk.length;
        log(`Seeded ${seededCount}/${pincodesToInsert.length} pincodes...`);
      }
      
      log('Pincode seeding completed successfully!');
      return {
        success: true,
        logs,
      };
    } catch (e: any) {
      log(`Error: ${e.message}`);
      return {
        success: false,
        logs,
        error: e.message,
      };
    }
  }

  @Get('diagnostics/pincodes-check')
  async pincodesCheck() {
    try {
      const count = await this.prisma.pincode.count();
      const samples = await this.prisma.pincode.findMany({
        take: 10,
        select: {
          pincode: true,
          officeName: true,
          district: true,
          state: true,
          region: true,
        }
      });
      const check627152 = await this.prisma.pincode.findUnique({
        where: { pincode: '627152' },
      });
      return {
        success: true,
        totalPincodes: count,
        check627152: check627152 ? {
          found: true,
          data: check627152,
        } : {
          found: false,
        },
        samples,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
      };
    }
  }

  @Get('diagnostics/cache-stats')
  getCacheStats() {
    if (process.env.NODE_ENV === 'production') {
      return { message: 'Diagnostics disabled in production' };
    }
    return {
      cache: this.cacheService.getStats(),
      process: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
      }
    };
  }

  @Post('diagnostics/cache-flush')
  @HttpCode(HttpStatus.OK)
  flushCache() {
    if (process.env.NODE_ENV === 'production') {
      return { message: 'Diagnostics disabled in production' };
    }
    this.cacheService.flush();
    return { success: true, message: 'Cache flushed successfully' };
  }
}
