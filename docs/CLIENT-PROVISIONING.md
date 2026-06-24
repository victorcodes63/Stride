# Client provisioning runbook

Provision a **dedicated HRIS instance** for one company: own database, Vercel project, env vars, and domain.

**Target time:** under 4 hours for first client; under 30 minutes once templated.

---

## Prerequisites

- Neon (or Postgres) account
- Vercel account linked to this repository
- Client branding assets (logo PNG/SVG, org name, contact email)
- Client admin email and initial password
- SMTP credentials (Microsoft 365 or client mail server)

---

## 1. Create the database

1. In [Neon](https://neon.tech), create a new project: `{client-slug}-hris`
2. Copy the **pooled** connection string → `DATABASE_URL`
3. Copy the **direct** (non-pooler) connection string → `DIRECT_DATABASE_URL`
4. Enable automatic backups (Neon default on paid; confirm on free tier limits)

---

## 2. Create the Vercel project

1. **Add New Project** → import `Stride` repository
2. Project name: `{client-slug}-hris` (e.g. `acme-hris`)
3. Root directory: `Stride`
4. Framework: Next.js (auto-detected)

Do **not** share this Vercel project with other clients — one project per company.

---

## 3. Configure environment variables

Copy from `.env.example`. Minimum **production** set:

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://…-pooler…` | Runtime queries |
| `DIRECT_DATABASE_URL` | `postgresql://…direct…` | Migrations at build |
| `NEXT_PUBLIC_APP_NAME` | `Acme HRIS` | Shown in UI |
| `NEXT_PUBLIC_ORG_NAME` | `Acme Limited` | Organisation name |
| `NEXT_PUBLIC_SITE_URL` | `https://hr.acme.co.ke` | Canonical URL |
| `NEXT_PUBLIC_BRAND_LOGO` | `/brand/acme-logo.png` | Upload to `public/brand/` |
| `PROVISION_ORG_NAME` | `Acme Limited` | DB workspace name |
| `PROVISION_ADMIN_EMAIL` | `hr.admin@acme.co.ke` | First admin user |
| `PROVISION_ADMIN_PASSWORD` | *(strong secret)* | Initial login password |
| `STAFF_PASSWORD` | same as above | Fallback for seed |
| `STAFF_ALLOWED_DOMAIN` | `acme.co.ke` | Login domain allowlist |
| `DEFAULT_COUNTRY` | `KE` | Statutory defaults (single-entity mode) |
| `MULTI_ENTITY_ENABLED` | `false` | Commercial gate — set `true` only when client purchased multi-region |
| `PROVISION_CURRENCY` | `KES` | Payroll currency |
| `SMTP_*` | … | Transactional email |
| `BLOB_READ_WRITE_TOKEN` | *(Vercel Blob)* | Document uploads |
| `CRON_SECRET` | *(random 32+ chars)* | Scheduled jobs |
| `DEMO_MODE` | *(unset or false)* | **Must be off** |
| `NEXT_PUBLIC_DEMO_MODE` | *(unset or false)* | **Must be off** |

### Module licensing

All modules default to **enabled**. Disable unpurchased modules:

```env
MODULE_ACCOUNTS=false
MODULE_HSE=false
```

See `.env.example` for full `MODULE_*` list.

### Multi-entity (optional)

Single-country clients (default):

```env
MULTI_ENTITY_ENABLED=false
DEFAULT_COUNTRY=KE
```

The dashboard **does not** show an entity switcher. All HR data scopes to the default country entity.

Multi-country clients (licensed):

```env
MULTI_ENTITY_ENABLED=true
DEFAULT_COUNTRY=KE
```

After first deploy, an admin configures legal entities in **Dashboard → Admin → Company setup → Operating regions & legal entities** (names, currencies, employee prefixes). Saving syncs `OutsourcingClient` rows by `entityCode`. Staff switch context in the top bar; payroll and employees scope to the active entity cookie.

Production seed with `MULTI_ENTITY_ENABLED=true` creates two workspace clients (`ke`, `ug`) with distinct prefixes. Demo seed (`npm run seed:demo` or `npm run db:seed-all-demo`) uses the active **demo pack** (`DEMO_PACK`, default `generic`) — see [`DEMO-CONTEXTS.md`](./DEMO-CONTEXTS.md).

Validate entity config:

```bash
npm run provision:check
npm run smoke:platform   # checks GET /api/config/entities
```

Validate locally before deploy:

```bash
cp .env.example .env.local
# fill in values
npm run provision:check
```

---

## 4. Upload client branding

1. Add logo to `public/brand/acme-logo.png` (commit to a client-specific branch or deploy via CI asset step)
2. Set `NEXT_PUBLIC_BRAND_LOGO` and `NEXT_PUBLIC_BRAND_LOGO_PNG` to match

---

## 5. Deploy and migrate

1. Push to the branch connected to the Vercel project (or deploy from CLI)
2. Build runs `prisma migrate deploy` automatically (see `scripts/prisma-migrate-deploy.js`)
3. Confirm deploy succeeds in Vercel dashboard

---

## 6. Seed production data

Run **once** against the client database (local machine with `DATABASE_URL` pointed at client DB, or Vercel one-off command):

```bash
cd Stride
export DATABASE_URL="postgresql://…"
export PROVISION_ADMIN_EMAIL="hr.admin@acme.co.ke"
export PROVISION_ADMIN_PASSWORD="…"
export PROVISION_ORG_NAME="Acme Limited"
export NEXT_PUBLIC_ORG_NAME="Acme Limited"
npm run seed:production
npm run db:seed-onboarding-templates
```

This creates:

- Primary workspace (organisation)
- Admin user with RBAC catalog
- Kenyan public holidays
- Employee + staff leave types
- Default department
- Recruitment settings shell

It does **not** create demo employees or sample payroll.

---

## 7. Configure domain

1. Vercel → Project → Settings → Domains
2. Add `hr.acme.co.ke` (or client subdomain)
3. Update DNS CNAME per Vercel instructions
4. Confirm `NEXT_PUBLIC_SITE_URL` matches the live domain

---

## 8. Smoke test

```bash
SMOKE_BASE_URL=https://hr.acme.co.ke \
SMOKE_LOGIN_EMAIL=hr.admin@acme.co.ke \
SMOKE_LOGIN_PASSWORD='…' \
npm run smoke:platform
```

Expected: deployment config, login, employees list, module-aware payroll/ATS checks.

---

## 9. Hand off to client

Provide:

- Staff login URL: `https://hr.acme.co.ke/dashboard/login`
- ESS URL: `https://hr.acme.co.ke/ess/login`
- Admin credentials (secure channel — not email plaintext if avoidable)
- Short operator guide (leave, payroll, employees)

---

## Demo / sales instance (optional)

For internal demos only:

```env
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
```

Then:

```bash
npm run provision:check -- --profile demo
npm run seed:demo
```

Demo login hints appear on login pages. **Never** enable on paying client deployments.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Migration P1002 on Vercel | Set `DIRECT_DATABASE_URL` (non-pooler) |
| Login domain rejected | Add domain to `STAFF_ALLOWED_DOMAIN` |
| Module visible but 403 on API | Check `MODULE_*` env; redeploy after change |
| Upload fails in production | Create Vercel Blob store; set token |
| Wrong org name on first load | Re-run `seed:production` or update workspace in DB |

---

## Related docs

- [`RELEASE-PROCESS.md`](./RELEASE-PROCESS.md) — shipping updates to client fleet
- [`FLEET-REGISTRY.md`](./FLEET-REGISTRY.md) — track all client instances
- [`STRIDE-MASTER-PLAN.md`](./STRIDE-MASTER-PLAN.md) — canonical product roadmap
