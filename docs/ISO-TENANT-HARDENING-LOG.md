# Tenant Isolation Hardening — AUTO-RUN-LOG

Branch: `iso/tenant-hardening` (app repo) — **not pushed to main**

| Issue | Status | Notes |
|-------|--------|-------|
| RAV-245 ISO-01 | done | Demo branding fallbacks removed; `deployment-cell.ts`; VICTOR TODO env split |
| RAV-246 ISO-02 | pending | |
| RAV-247 ISO-03 | pending | |
| RAV-248 ISO-04 | done | ATS, leave, time, vertical modules + ESS shell routes migrated to withTenant/withEssTenant |
| RAV-249 ISO-05 | pending | |
| RAV-250 ISO-06 | pending | Handoff only — no DB role flip |

## RAV-245 verify (2026-06-27)

- `npm test -- --run deployment-cell` — 4/4 pass
- `RUN_MIGRATIONS_ON_BUILD=false npx next build` — compiled OK
- VICTOR TODO: `app/docs/VICTOR-TODO-ISO-01-DEMO-SPLIT.md`
