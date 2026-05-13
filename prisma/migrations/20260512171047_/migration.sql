-- CreateEnum
CREATE TYPE "ShippingType" AS ENUM ('HOME', 'STOP_DESK');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shippingType" "ShippingType" NOT NULL DEFAULT 'HOME',
ALTER COLUMN "address" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "description" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "ShippingConfig" (
    "id" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "homeCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stopDeskCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "changeCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingConfig_stateName_key" ON "ShippingConfig"("stateName");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingConfig_stateCode_key" ON "ShippingConfig"("stateCode");
