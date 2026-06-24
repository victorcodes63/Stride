-- RAV-65: Global country config packs (no RLS — shared reference data).

CREATE TYPE "CountryPackKind" AS ENUM ('statutory', 'locale', 'holidays');

CREATE TABLE "country_config" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "country" TEXT NOT NULL,
  "kind" "CountryPackKind" NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "country_config_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "country_config_country_kind_effectiveFrom_idx"
  ON "country_config"("country", "kind", "effectiveFrom");
