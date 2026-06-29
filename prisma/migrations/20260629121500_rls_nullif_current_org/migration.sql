-- Follow-up: nullif avoids uuid cast errors when app.current_org is unset (login flows).

DROP POLICY IF EXISTS "OrganizationMembership_tenant_rw" ON "OrganizationMembership";
CREATE POLICY "OrganizationMembership_tenant_rw" ON "OrganizationMembership"
  FOR ALL
  USING ("organizationId" = nullif(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK ("organizationId" = nullif(current_setting('app.current_org', true), '')::uuid);

DROP POLICY IF EXISTS "Organization_tenant_select" ON "Organization";
CREATE POLICY "Organization_tenant_select" ON "Organization"
  FOR SELECT
  USING (id = nullif(current_setting('app.current_org', true), '')::uuid);

DROP POLICY IF EXISTS "Organization_tenant_update" ON "Organization";
CREATE POLICY "Organization_tenant_update" ON "Organization"
  FOR UPDATE
  USING (id = nullif(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.current_org', true), '')::uuid);
