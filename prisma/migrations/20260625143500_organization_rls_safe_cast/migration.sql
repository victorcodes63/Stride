-- Prevent RLS policy errors when app.current_org is unset (login, bootstrap).

DROP POLICY IF EXISTS "Organization_tenant_select" ON "Organization";
CREATE POLICY "Organization_tenant_select" ON "Organization"
  FOR SELECT
  USING (
    coalesce(current_setting('app.current_org', true), '') <> ''
    AND id = current_setting('app.current_org', true)::uuid
  );

DROP POLICY IF EXISTS "Organization_tenant_update" ON "Organization";
CREATE POLICY "Organization_tenant_update" ON "Organization"
  FOR UPDATE
  USING (
    coalesce(current_setting('app.current_org', true), '') <> ''
    AND id = current_setting('app.current_org', true)::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') <> ''
    AND id = current_setting('app.current_org', true)::uuid
  );
