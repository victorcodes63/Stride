-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('draft', 'issued', 'fulfilled', 'cancelled');

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "lpoNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'draft',
    "vendorId" TEXT NOT NULL,
    "vendorBillId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_purchaseRequestId_key" ON "PurchaseOrder"("purchaseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_lpoNumber_key" ON "PurchaseOrder"("lpoNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_outsourcingClientId_idx" ON "PurchaseOrder"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_issuedAt_idx" ON "PurchaseOrder"("issuedAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountsVendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorBillId_fkey" FOREIGN KEY ("vendorBillId") REFERENCES "AccountsVendorBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderLine" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PurchaseOrder_tenant_isolation" ON "PurchaseOrder"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY "PurchaseOrderLine_tenant_isolation" ON "PurchaseOrderLine"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);
