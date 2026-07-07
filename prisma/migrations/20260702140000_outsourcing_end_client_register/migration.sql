-- OUT-02: End-client register — status, contract notes, report branding, rate cards

ALTER TABLE "OutsourcingClient"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "contractNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "clientLogoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "reportAccentColor" TEXT,
  ADD COLUMN IF NOT EXISTS "whiteLabelReports" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reportRecipientEmails" JSONB,
  ADD COLUMN IF NOT EXISTS "reportSections" JSONB;

CREATE INDEX IF NOT EXISTS "OutsourcingClient_organizationId_status_idx"
  ON "OutsourcingClient"("organizationId", "status");

CREATE TABLE "OutsourcingRateCard" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "name" TEXT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutsourcingRateCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutsourcingRateCardLine" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "rateCardId" TEXT NOT NULL,
  "serviceKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "pricingModel" TEXT NOT NULL,
  "unitAmount" DECIMAL(12,2) NOT NULL,
  "percentageBps" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutsourcingRateCardLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutsourcingRateCard_outsourcingClientId_isActive_idx"
  ON "OutsourcingRateCard"("outsourcingClientId", "isActive");

CREATE INDEX "OutsourcingRateCard_outsourcingClientId_effectiveFrom_idx"
  ON "OutsourcingRateCard"("outsourcingClientId", "effectiveFrom");

CREATE INDEX "OutsourcingRateCardLine_rateCardId_sortOrder_idx"
  ON "OutsourcingRateCardLine"("rateCardId", "sortOrder");

ALTER TABLE "OutsourcingRateCard"
  ADD CONSTRAINT "OutsourcingRateCard_outsourcingClientId_fkey"
  FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutsourcingRateCardLine"
  ADD CONSTRAINT "OutsourcingRateCardLine_rateCardId_fkey"
  FOREIGN KEY ("rateCardId") REFERENCES "OutsourcingRateCard"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutsourcingRateCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutsourcingRateCardLine" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OutsourcingRateCard_tenant_isolation" ON "OutsourcingRateCard"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY "OutsourcingRateCardLine_tenant_isolation" ON "OutsourcingRateCardLine"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);
