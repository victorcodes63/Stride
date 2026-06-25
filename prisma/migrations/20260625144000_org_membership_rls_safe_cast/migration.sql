-- Prevent OrganizationMembership RLS errors when app.current_org is unset (login).

DROP POLICY IF EXISTS "OrganizationMembership_tenant_rw" ON "OrganizationMembership";
CREATE POLICY "OrganizationMembership_tenant_rw" ON "OrganizationMembership"
  FOR ALL
  USING (
    coalesce(current_setting('app.current_org', true), '') <> ''
    AND "organizationId" = current_setting('app.current_org', true)::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') <> ''
    AND "organizationId" = current_setting('app.current_org', true)::uuid
  );
