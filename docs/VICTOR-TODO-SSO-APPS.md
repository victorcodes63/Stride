# VICTOR TODO — Register Stride platform OAuth apps

Account-level steps before multi-tenant SSO works in production. Code is scaffolded to read
`STRIDE_*` env vars (with legacy `MS_CLIENT_*` / `GOOGLE_CLIENT_*` fallback for local dev).

## 1. Microsoft Entra (multi-tenant, work/school)

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: `Stride Platform SSO` (or similar)
3. Supported account types: **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)**
4. Redirect URIs (Web):
   - `https://app.getstride.co.ke/api/auth/microsoft/callback` (staff)
   - `https://app.getstride.co.ke/api/ess/auth/microsoft/callback` (ESS)
   - `http://localhost:3000/api/auth/microsoft/callback` (local staff)
   - `http://localhost:3000/api/ess/auth/microsoft/callback` (local ESS)
5. **Certificates & secrets** → New client secret → copy value once
6. **API permissions** → Delegated: `openid`, `profile`, `email`, `User.Read` → Grant admin consent (Raven tenant)
7. Set Vercel env on **stride-platform** (pooled app):
   ```
   STRIDE_MS_CLIENT_ID=<application-client-id>
   STRIDE_MS_CLIENT_SECRET=<secret>
   ```
8. Do **not** set a single-tenant `MS_TENANT_ID` for OAuth — code uses `/common`. Keep `MS_TENANT_ID` only if the same app sends Graph mail from Raven’s tenant.

## 2. Google Cloud (Workspace)

1. Google Cloud Console → **APIs & Services** → **Credentials** → **Create OAuth client ID** → Web application
2. Name: `Stride Platform SSO`
3. Authorized redirect URIs:
   - `https://app.getstride.co.ke/api/auth/google/callback`
   - `https://app.getstride.co.ke/api/ess/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
   - `http://localhost:3000/api/ess/auth/google/callback`
4. OAuth consent screen: **Internal** (Raven) or **External** with verified domain if testing external Workspace tenants
5. Set Vercel env:
   ```
   STRIDE_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
   STRIDE_GOOGLE_CLIENT_SECRET=<secret>
   ```

## 3. Retire per-deployment pattern

After cutover, remove from dedicated deployment env files (not needed on pooled `app.getstride.co.ke`):

- `STAFF_ALLOWED_DOMAIN` → per-org domains in Company Setup + DNS verification
- Per-customer `MS_CLIENT_ID` / `MS_CLIENT_SECRET` → use platform secrets only

## 4. Smoke test

1. Company Setup → add and verify a test domain (DNS TXT)
2. Enable Microsoft or Google for that org (Growth+)
3. Sign in at `app.getstride.co.ke` with a `@yourdomain.co.ke` work account
4. Confirm OAuth completes and user lands in the correct org only
