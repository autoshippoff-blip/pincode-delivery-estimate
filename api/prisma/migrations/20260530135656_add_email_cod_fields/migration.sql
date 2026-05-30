-- AlterTable
ALTER TABLE "DeliveryRule" ADD COLUMN     "codBlockedPincodes" TEXT[];

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "codEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email" TEXT;
