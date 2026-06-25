-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('draft', 'posted');

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "receivedAt" DATE NOT NULL,
    "receivedByUserId" TEXT NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_grnNumber_key" ON "GoodsReceipt"("grnNumber");

-- CreateIndex
CREATE INDEX "GoodsReceipt_outsourcingClientId_idx" ON "GoodsReceipt"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_receivedAt_idx" ON "GoodsReceipt"("receivedAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_goodsReceiptId_idx" ON "GoodsReceiptLine"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_purchaseOrderLineId_idx" ON "GoodsReceiptLine"("purchaseOrderLineId");

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE "GoodsReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoodsReceiptLine" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GoodsReceipt_tenant_isolation" ON "GoodsReceipt"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY "GoodsReceiptLine_tenant_isolation" ON "GoodsReceiptLine"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);
