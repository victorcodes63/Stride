-- Allow stride_app to load organization rows while resolving login memberships
-- (before app.current_org is set on the session).

DROP POLICY IF EXISTS "Organization_login_read" ON "Organization";
CREATE POLICY "Organization_login_read" ON "Organization"
  FOR SELECT
  USING (
    current_setting('app.login_user_id', true) <> ''
    AND EXISTS (
      SELECT 1
      FROM "OrganizationMembership" om
      WHERE om."organizationId" = "Organization".id
        AND om."userId" = current_setting('app.login_user_id', true)
        AND om.status = 'active'
    )
  );
