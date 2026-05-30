import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      apiKey: true,
      isActive: true,
    }
  });
  console.log('--- TENANTS IN DATABASE ---');
  console.log(JSON.stringify(tenants, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
