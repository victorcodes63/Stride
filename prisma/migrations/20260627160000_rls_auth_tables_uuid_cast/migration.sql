-- Pre-login auth lookups set app.auth_public_lookup without app.current_org.
-- PostgreSQL evaluates all permissive RLS policies; unsafe ::uuid casts throw 22P02.

DROP POLICY IF EXISTS "OrganizationEmailDomain_tenant_rw" ON "OrganizationEmailDomain";
CREATE POLICY "OrganizationEmailDomain_tenant_rw" ON "OrganizationEmailDomain"
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

DROP POLICY IF EXISTS "OrganizationAuthConfig_tenant_rw" ON "OrganizationAuthConfig";
CREATE POLICY "OrganizationAuthConfig_tenant_rw" ON "OrganizationAuthConfig"
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
