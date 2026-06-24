-- Affordable Housing Levy: 1.5% of gross; deductible before PAYE (Kenya)
ALTER TABLE "Payroll" ADD COLUMN "ahl" DECIMAL(12,2) NOT NULL DEFAULT 0;
