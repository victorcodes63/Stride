# Fleet registry

**Source of truth:** Stride Control Plane (`control-plane`) — not a spreadsheet.

- **Import:** `/fleet` CSV import upserts customers by slug
- **Export:** `GET /api/fleet-registry/export` (authenticated) or download from Fleet page
- **Health:** cron `GET /api/cron/fleet-health` polls each instance `/api/config/deployment`

Track every **dedicated client deployment** from a single operational view. This is not product multi-tenancy — it is internal ops visibility over separate instances.

---

## Registry template

Legacy spreadsheet columns are preserved for exports. Copy to Notion or Google Sheets only if needed for offline review:

| Client | Status | Production URL | Vercel project | Neon project | Git tag / version | Last deploy | Modules disabled | Admin contact | Notes |
|--------|--------|----------------|----------------|--------------|-------------------|-------------|------------------|---------------|-------|
| Acme Ltd | Live | https://hr.acme.co.ke | acme-hris | acme-hris-prod | v0.3.0 | 2026-05-20 | — | hr@acme.co.ke | Kenya payroll |
| Beta Corp | Pilot | https://hr.beta.co.ke | beta-hris | beta-hris-prod | v0.3.0 | 2026-05-18 | MODULE_ACCOUNTS | ops@beta.co.ke | Essentials bundle |
| Internal demo | Demo | https://demo.hris.example.com | Stride | Stride-dev | main | 2026-05-26 | — | — | DEMO_MODE=true |

### Column definitions

- **Status:** `Pilot` | `Live` | `Suspended` | `Demo` | `Archived`
- **Git tag / version:** Release tag deployed (see [`RELEASE-PROCESS.md`](./RELEASE-PROCESS.md))
- **Modules disabled:** Comma-separated `MODULE_*=false` flags on that instance
- **Last deploy:** Date of last successful Vercel production promotion

---

## Health checks (monthly)

For each **Live** client:

1. `npm run smoke:platform` against their URL
2. Confirm backup retention in Neon
3. Confirm `DEMO_MODE` is not enabled
4. Confirm SSL certificate valid on custom domain
5. Spot-check cron jobs (contract/credential reminders) in Vercel logs

---

## Adding a new client

1. Complete [`CLIENT-PROVISIONING.md`](./CLIENT-PROVISIONING.md)
2. Use Control Plane **Provision wizard** (`/provision`) and Fleet import
3. Record module flags and pricing tier in commercial notes (customer detail)

---

## Removing / archiving a client

1. Set status → `Archived`
2. Export client data if contract requires (DB dump, payroll exports)
3. Disable Vercel production deploys; retain Neon snapshot per retention policy
4. Do not delete registry row — keep for audit history

---

## Optional: fleet API check script

Query deployment metadata from each instance:

```bash
curl -s https://hr.acme.co.ke/api/config/deployment | jq '{orgName, demoMode, modules}'
```

Use in CI or a monthly cron to detect version drift across the fleet.
