-- Bi-weekly payroll: two period grosses per month; monthly statutory on combined gross
ALTER TABLE "OutsourcingClient" ADD COLUMN "payrollFrequency" TEXT DEFAULT 'monthly';

ALTER TABLE "Payroll" ADD COLUMN "period1Gross" DECIMAL(12,2);
ALTER TABLE "Payroll" ADD COLUMN "period2Gross" DECIMAL(12,2);
