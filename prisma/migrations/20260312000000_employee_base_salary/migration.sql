-- Monthly basic salary: default for new payroll rows & reporting
ALTER TABLE "Employee" ADD COLUMN "baseSalary" DECIMAL(12,2);
