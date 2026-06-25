-- Allow stride_app to resolve a user's org memberships during password/OAuth login
-- (before app.current_org is established on the session).

DROP POLICY IF EXISTS "OrganizationMembership_login_read" ON "OrganizationMembership";
CREATE POLICY "OrganizationMembership_login_read" ON "OrganizationMembership"
  FOR SELECT
  USING (
    current_setting('app.login_user_id', true) <> ''
    AND "userId" = current_setting('app.login_user_id', true)
  );
