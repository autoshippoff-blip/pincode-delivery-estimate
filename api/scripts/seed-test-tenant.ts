import { PrismaClient, EtaMode } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding multi-tenant test data and configurations...');

  const tenantsData = [
    {
      apiKey: 'api_key_merchant_a',
      name: 'Merchant A (Custom Quick Delivery)',
      isActive: true,
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
      etaMode: EtaMode.STATIC_RULES,
      overrides: [
        { region: 'south', minDays: 1, maxDays: 1 },
        { region: 'central', minDays: 3, maxDays: 4 },
      ],
      warehouse: {
        name: 'Merchant A Chennai Hub',
        pincode: '600001',
        city: 'Chennai',
        state: 'Tamil Nadu',
      },
    },
    {
      apiKey: 'api_key_merchant_b',
      name: 'Merchant B (Slower Deliveries)',
      isActive: true,
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
      etaMode: EtaMode.STATIC_RULES,
      overrides: [
        { region: 'south', minDays: 3, maxDays: 5 },
        { region: 'west', minDays: 5, maxDays: 6 },
      ],
      warehouse: {
        name: 'Merchant B Mumbai Hub',
        pincode: '400001',
        city: 'Mumbai',
        state: 'Maharashtra',
      },
    },
    {
      apiKey: 'api_key_merchant_c',
      name: 'Merchant C (System Defaults)',
      isActive: true,
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
      etaMode: EtaMode.STATIC_RULES,
      overrides: [], // No overrides, should use system default fallback
      warehouse: {
        name: 'Merchant C Delhi Hub',
        pincode: '110001',
        city: 'Delhi',
        state: 'Delhi',
      },
    },
    {
      apiKey: 'demo_merchant_key',
      name: 'Demo Merchant Widget',
      isActive: true,
      allowedOrigins: ['*'], // Allow any origin for demo testing
      etaMode: EtaMode.STATIC_RULES,
      overrides: [
        { region: 'south', minDays: 2, maxDays: 3 }, // Distinct from system default (2-4 days)
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
      isActive: true,
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
      etaMode: EtaMode.STATIC_RULES,
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
    },
  ];

  try {
    for (const data of tenantsData) {
      // 1. Upsert Tenant
      const tenant = await prisma.tenant.upsert({
        where: { apiKey: data.apiKey },
        update: {
          name: data.name,
          isActive: data.isActive,
          allowedOrigins: data.allowedOrigins,
          etaMode: data.etaMode,
        },
        create: {
          name: data.name,
          apiKey: data.apiKey,
          isActive: data.isActive,
          allowedOrigins: data.allowedOrigins,
          etaMode: data.etaMode,
        },
      });

      console.log(`\nTenant created/updated: ${tenant.name} (${tenant.id})`);

      // 2. Refresh Delivery Rules overrides
      await prisma.deliveryRule.deleteMany({
        where: { tenantId: tenant.id },
      });

      for (const override of data.overrides) {
        const rule = await prisma.deliveryRule.create({
          data: {
            tenantId: tenant.id,
            region: override.region,
            minDays: override.minDays,
            maxDays: override.maxDays,
            isActive: true,
          },
        });
        console.log(` - Created delivery rule override for ${rule.region}: ${rule.minDays}-${rule.maxDays} Days`);
      }

      // 3. Refresh origin Warehouse
      await prisma.warehouse.deleteMany({
        where: { tenantId: tenant.id },
      });

      const warehouse = await prisma.warehouse.create({
        data: {
          tenantId: tenant.id,
          name: data.warehouse.name,
          pincode: data.warehouse.pincode,
          city: data.warehouse.city,
          state: data.warehouse.state,
        },
      });
      console.log(` - Created warehouse: ${warehouse.name} at pincode ${warehouse.pincode}`);
    }

    console.log('\nAll test tenants and configurations seeded successfully!');
  } catch (error) {
    console.error('Error seeding test tenants:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
