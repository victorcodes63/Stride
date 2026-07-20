-- AlterTable
ALTER TABLE "SalesQuote" ADD COLUMN     "accountsInvoiceId" TEXT;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_accountsInvoiceId_fkey" FOREIGN KEY ("accountsInvoiceId") REFERENCES "AccountsInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

