-- Poll watermark for Hikvision ISAPI back-fill (independent of latest punch observedAt).

ALTER TABLE "BiometricDevice" ADD COLUMN "lastPollAt" TIMESTAMP(3);

CREATE INDEX "BiometricDevice_lastPollAt_idx" ON "BiometricDevice"("lastPollAt");
