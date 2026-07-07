-- Pre-login auth: guard uuid casts on OrganizationEmailDomain / OrganizationAuthConfig
-- when app.current_org is unset (login email resolution).

DROP POLICY IF EXISTS "OrganizationEmailDomain_tenant_rw" ON "OrganizationEmailDomain";
CREATE POLICY "OrganizationEmailDomain_tenant_rw" ON "OrganizationEmailDomain"
  FOR ALL
  USING ("organizationId" = nullif(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organizationId" = nullif(current_setting('app.current_org', true), '')::uuid);

DROP POLICY IF EXISTS "OrganizationAuthConfig_tenant_rw" ON "OrganizationAuthConfig";
CREATE POLICY "OrganizationAuthConfig_tenant_rw" ON "OrganizationAuthConfig"
  FOR ALL
  USING ("organizationId" = nullif(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organizationId" = nullif(current_setting('app.current_org', true), '')::uuid);
