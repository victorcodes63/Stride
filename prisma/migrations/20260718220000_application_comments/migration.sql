-- Recruitment collaboration: threaded internal comments on an application, with @mentions.
-- Idempotent: safe to run against db-push-baselined databases (P3005) via `prisma db execute`.

-- CreateTable ApplicationComment
CREATE TABLE IF NOT EXISTS "ApplicationComment" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationComment_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ApplicationComment_applicationId_createdAt_idx" ON "ApplicationComment"("applicationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ApplicationComment_authorUserId_idx" ON "ApplicationComment"("authorUserId");

-- Foreign keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationComment_applicationId_fkey') THEN
    ALTER TABLE "ApplicationComment" ADD CONSTRAINT "ApplicationComment_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationComment_authorUserId_fkey') THEN
    ALTER TABLE "ApplicationComment" ADD CONSTRAINT "ApplicationComment_authorUserId_fkey"
      FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS: ApplicationComment
ALTER TABLE "ApplicationComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationComment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ApplicationComment_tenant_rw" ON "ApplicationComment";
CREATE POLICY "ApplicationComment_tenant_rw" ON "ApplicationComment" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "ApplicationComment_insert_bootstrap" ON "ApplicationComment";
CREATE POLICY "ApplicationComment_insert_bootstrap" ON "ApplicationComment" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
