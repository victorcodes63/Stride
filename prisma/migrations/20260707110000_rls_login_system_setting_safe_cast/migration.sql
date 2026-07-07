-- Login / bootstrap reads: guard SystemSetting tenant_rw uuid cast when app.current_org unset.

DROP POLICY IF EXISTS "SystemSetting_tenant_rw" ON "SystemSetting";
CREATE POLICY "SystemSetting_tenant_rw" ON "SystemSetting"
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
