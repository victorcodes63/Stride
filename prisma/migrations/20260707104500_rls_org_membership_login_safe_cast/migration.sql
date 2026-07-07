-- OAuth/password login: guard OrganizationMembership tenant_rw uuid cast when app.current_org unset.

DROP POLICY IF EXISTS "OrganizationMembership_tenant_rw" ON "OrganizationMembership";
CREATE POLICY "OrganizationMembership_tenant_rw" ON "OrganizationMembership"
  FOR ALL
  USING ("organizationId" = nullif(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organizationId" = nullif(current_setting('app.current_org', true), '')::uuid);
