-- Per-client payslip email sender identity (phased white-label delivery).
-- Option B: platform domain + client From name / Reply-To. Option C: verified custom sending domain.
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipFromName" TEXT;
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipReplyTo" TEXT;
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipSenderMode" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipSenderLocalPart" TEXT;
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipSenderDomain" TEXT;
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipResendDomainId" TEXT;
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipDomainStatus" TEXT;
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipDomainRecords" JSONB;
ALTER TABLE "OutsourcingClient" ADD COLUMN "payslipDomainVerifiedAt" TIMESTAMP(3);
