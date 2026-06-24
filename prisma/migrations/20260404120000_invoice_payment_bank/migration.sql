-- CreateEnum
CREATE TYPE "AccountsInvoicePaymentBank" AS ENUM ('payroll_only', 'consultancy_fees');

-- AlterTable
ALTER TABLE "AccountsInvoice" ADD COLUMN "paymentBank" "AccountsInvoicePaymentBank" NOT NULL DEFAULT 'consultancy_fees';
