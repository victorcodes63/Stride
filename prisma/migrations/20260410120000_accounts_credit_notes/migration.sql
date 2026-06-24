-- AlterTable
ALTER TABLE "AccountsClient" ADD COLUMN "nextCreditNoteNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "AccountsCreditNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "originalInvoiceId" TEXT NOT NULL,
    "creditNoteNumber" INTEGER NOT NULL,
    "issueDate" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "vatRateBps" INTEGER NOT NULL DEFAULT 1600,
    "totalIncVat" DECIMAL(14,2) NOT NULL,
    "paymentBank" "AccountsInvoicePaymentBank" NOT NULL DEFAULT 'consultancy_fees',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsCreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "amountExVat" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountsCreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountsCreditNote_clientId_idx" ON "AccountsCreditNote"("clientId");

-- CreateIndex
CREATE INDEX "AccountsCreditNote_originalInvoiceId_idx" ON "AccountsCreditNote"("originalInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsCreditNote_clientId_creditNoteNumber_key" ON "AccountsCreditNote"("clientId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "AccountsCreditNoteLine_creditNoteId_idx" ON "AccountsCreditNoteLine"("creditNoteId");

-- AddForeignKey
ALTER TABLE "AccountsCreditNote" ADD CONSTRAINT "AccountsCreditNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AccountsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsCreditNote" ADD CONSTRAINT "AccountsCreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "AccountsInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsCreditNoteLine" ADD CONSTRAINT "AccountsCreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "AccountsCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
