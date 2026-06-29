-- Pre-login org resolution: allow Organization SELECT when auth_public_lookup is set
-- (OrganizationEmailDomain already has auth_public_lookup; include-join was returning null org)

DROP POLICY IF EXISTS "Organization_auth_public_lookup" ON "Organization";
CREATE POLICY "Organization_auth_public_lookup" ON "Organization"
  FOR SELECT
  USING (current_setting('app.auth_public_lookup', true) = 'true');
