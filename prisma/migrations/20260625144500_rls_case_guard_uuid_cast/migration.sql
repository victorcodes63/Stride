-- PostgreSQL does not short-circuit RLS expressions — guard uuid casts when app.current_org is unset.

DROP POLICY IF EXISTS "OrganizationMembership_tenant_rw" ON "OrganizationMembership";
CREATE POLICY "OrganizationMembership_tenant_rw" ON "OrganizationMembership"
  FOR ALL
  USING (
    CASE
      WHEN coalesce(current_setting('app.current_org', true), '') = '' THEN false
      ELSE "organizationId" = current_setting('app.current_org', true)::uuid
    END
  )
  WITH CHECK (
    CASE
      WHEN coalesce(current_setting('app.current_org', true), '') = '' THEN false
      ELSE "organizationId" = current_setting('app.current_org', true)::uuid
    END
  );

DROP POLICY IF EXISTS "Organization_tenant_select" ON "Organization";
CREATE POLICY "Organization_tenant_select" ON "Organization"
  FOR SELECT
  USING (
    CASE
      WHEN coalesce(current_setting('app.current_org', true), '') = '' THEN false
      ELSE id = current_setting('app.current_org', true)::uuid
    END
  );

DROP POLICY IF EXISTS "Organization_tenant_update" ON "Organization";
CREATE POLICY "Organization_tenant_update" ON "Organization"
  FOR UPDATE
  USING (
    CASE
      WHEN coalesce(current_setting('app.current_org', true), '') = '' THEN false
      ELSE id = current_setting('app.current_org', true)::uuid
    END
  )
  WITH CHECK (
    CASE
      WHEN coalesce(current_setting('app.current_org', true), '') = '' THEN false
      ELSE id = current_setting('app.current_org', true)::uuid
    END
  );
