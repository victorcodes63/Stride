-- CreateTable
CREATE TABLE IF NOT EXISTS "ApplicationView" (
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationView_pkey" PRIMARY KEY ("applicationId","userId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationView_userId_idx" ON "ApplicationView"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationView_applicationId_idx" ON "ApplicationView"("applicationId");

-- AddForeignKey
ALTER TABLE "ApplicationView" ADD CONSTRAINT "ApplicationView_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
