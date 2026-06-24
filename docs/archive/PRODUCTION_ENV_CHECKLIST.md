# Production Environment Checklist

Use this checklist before deploying the ATS to production.

## 1) Database

- [ ] `DATABASE_URL` points to your production PostgreSQL
- [ ] `prisma migrate deploy` has been run
- [ ] Seeded/created at least one active admin user in `User` table

## 2) Staff Authentication (Microsoft + domain policy)

- [ ] `STAFF_ALLOWED_DOMAIN=example.com`
- [ ] `STAFF_SESSION_DAYS=7` (or your preferred value)
- [ ] `MS_TENANT_ID` set
- [ ] `MS_CLIENT_ID` set
- [ ] `MS_CLIENT_SECRET` set (secret **value**, not secret ID)
- [ ] Azure redirect URI includes:
  - [ ] `https://<your-domain>/api/auth/microsoft/callback`
- [ ] **NEXT_PUBLIC_SITE_URL** is set to your production domain (for example, `https://example.com`) for **Production and Preview** (so the app always sends that callback URI to Microsoft; otherwise Preview uses the deployment URL and Entra rejects it)
- [ ] `MS_OAUTH_DEBUG` is unset or `false` in production

## 2b) File uploads (Vercel Blob)

- [ ] **BLOB_READ_WRITE_TOKEN** is set (Vercel adds this when you create a Blob store)
- [ ] In Vercel: Project → **Storage** → **Create Database** or **Blob** → create a Blob store and link it to the project
- [ ] Without this, CV and certificate uploads fail in production with “Failed to upload CV”

## 3) Email (SMTP)

- [ ] `SMTP_HOST=smtp.office365.com` (or your SMTP host)
- [ ] `SMTP_PORT=587` (or 465 for SSL)
- [ ] `SMTP_USER=recruitment@example.com`
- [ ] `SMTP_PASS=<valid app password/credential>`
- [ ] `SMTP_FROM_NAME` set (optional but recommended)
- [ ] `NEXT_PUBLIC_SITE_URL=https://<your-domain>`

## 4) Monitoring / Alerts

- [ ] `MONITORING_WEBHOOK_URL` configured (Slack/Teams/webhook endpoint)
- [ ] Alert receiver is tested and receiving API failure notifications

## 5) Security and Operations

- [ ] No secrets committed in git
- [ ] `.env` exists only locally; production secrets set in host (e.g., Vercel env vars)
- [ ] Admin access reviewed (`/dashboard/users/staff` and recruitment client logins are admin-only)
- [ ] At least one backup admin account is active

## 6) Smoke Validation

Run:

```bash
npm run smoke:test
```

Expected:

- Login succeeds
- Job list loads
- Application submission succeeds
- Application status update succeeds
- Export endpoint returns XLSX
