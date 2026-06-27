# VICTOR TODO — ISO-06 Flip production DATABASE_URL to stride_app

**Do not execute from CI/agent.** Apply manually after merging `iso/tenant-hardening` and verifying on staging.

## Preconditions (must be green)

- [ ] `npm run audit:module-tenant` shows **>90%** migrated (branch target: ~97%)
- [ ] `npm run test:rls` passes against staging Neon (requires `DATABASE_URL` + `stride_app` role)
- [ ] `npm run test:cross-tenant` passes on staging
- [ ] ISO-05 migration `20260627130000_system_setting_composite_key` applied (`prisma migrate deploy`)
- [ ] Smoke test: login as Raven admin, dashboard empty, no cross-tenant data

## Vercel env change (stride-platform production)

**Set runtime URL to RLS-enforced role:**

```bash
# Derive stride_app pooled URL (see scripts/setup-stride-app-db-env.mjs / .stride-app-env.json)
# Then on Vercel production for stride-platform:

DATABASE_URL=postgresql://stride_app:***@<host>-pooler.<region>.aws.neon.tech/neondb?sslmode=require
POSTGRES_PRISMA_URL=<same as DATABASE_URL>
```

**Keep migrations on owner (unchanged):**

```bash
DIRECT_DATABASE_URL=postgresql://neondb_owner:***@<host>.<region>.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=<same as DIRECT_DATABASE_URL>
```

Helper scripts (run locally, not in agent):

- `node scripts/setup-stride-app-db-env.mjs` — rotate `stride_app` password + write `.stride-app-env.json`
- `node scripts/push-stride-app-db-role-env.mjs` — push to Vercel (review before running)

## Rollback (if production breaks)

1. Restore owner pooled URL on `DATABASE_URL`:

```bash
node scripts/restore-production-owner-database-url.mjs
```

2. Redeploy stride-platform (or revert deploy)

3. Investigate failing route via Vercel logs — unmigrated route querying without `withTenant()` will return empty/error under `stride_app`, not leak data.

## Why this matters

`neondb_owner` has **BYPASSRLS** — Postgres RLS policies do not protect production today. `stride_app` enforces tenant isolation at the database layer even if application code regresses.

## After flip

- [ ] Re-run smoke tests on app.getstride.co.ke
- [ ] Run `scripts/audit-default-org-memberships.ts` against production (owner URL) and clean dual memberships if any
- [ ] Apply ISO-01 env split (see `docs/VICTOR-TODO-ISO-01-DEMO-SPLIT.md`)
