-- M1 biometrics: additive — enums, BiometricDevice, BiometricPunch, FKs + indexes (order: device before punch)

CREATE TYPE "BiometricPunchSource" AS ENUM ('device', 'csv');

CREATE TYPE "BiometricPunchDirection" AS ENUM ('in', 'out', 'unknown');

CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adapterKind" TEXT NOT NULL,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiometricPunch" (
    "id" TEXT NOT NULL,
    "biometricDeviceId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "rawSubjectId" TEXT NOT NULL,
    "employeeId" TEXT,
    "rawPayload" JSONB,
    "source" "BiometricPunchSource" NOT NULL,
    "direction" "BiometricPunchDirection" NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BiometricPunch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BiometricDevice_outsourcingClientId_idx" ON "BiometricDevice"("outsourcingClientId");

CREATE INDEX "BiometricDevice_isActive_idx" ON "BiometricDevice"("isActive");

ALTER TABLE "BiometricPunch" ADD CONSTRAINT "BiometricPunch_biometricDeviceId_fkey" FOREIGN KEY ("biometricDeviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BiometricPunch" ADD CONSTRAINT "BiometricPunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "BiometricPunch_biometricDeviceId_externalEventId_key" ON "BiometricPunch"("biometricDeviceId", "externalEventId");

CREATE INDEX "BiometricPunch_biometricDeviceId_observedAt_idx" ON "BiometricPunch"("biometricDeviceId", "observedAt");

CREATE INDEX "BiometricPunch_employeeId_idx" ON "BiometricPunch"("employeeId");
