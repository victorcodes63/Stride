# Tenant Isolation Hardening — AUTO-RUN-LOG

Branch: `iso/tenant-hardening` (app repo) — **not pushed to main**

| Issue | Status | Notes |
|-------|--------|-------|
| RAV-245 ISO-01 | done | `deployment-cell.ts`; VICTOR TODO env split |
| RAV-246 ISO-02 | done | No auto-attach on customer cell |
| RAV-247 ISO-03 | done | High-traffic routes + all `/api/reports/*` |
| RAV-248 ISO-04 | done | **269/277 routes (97.1%)** tenant-wrapped |
| RAV-249 ISO-05 | done | SystemSetting composite PK + loader updates |
| RAV-250 ISO-06 | handoff | VICTOR TODO only — no DB role flip |

## Verify log

| Check | Result |
|-------|--------|
| `npm test -- --run deployment-cell org-membership` | 6/6 pass |
| `npm run audit:module-tenant` | 269/277 (97.1%) |
| `npm run test:rls` | Skipped locally — no DATABASE_URL (VICTOR: run on staging) |
| `npm run test:cross-tenant` | Skipped locally — no DATABASE_URL |
| `npx prisma generate` | OK after ISO-05 schema change |

## Commits (newest first)

- RAV-249: SystemSetting composite key (pending commit)
- RAV-248: core + ats/leave/time/vertical + accounts batches
- RAV-247: high-traffic routes
- RAV-246: ensureDefaultMembership gate
- RAV-245: demo branding fallbacks removed

## VICTOR TODOs (manual)

1. `docs/VICTOR-TODO-ISO-01-DEMO-SPLIT.md` — demo.getstride.co.ke vs app.getstride.co.ke env
2. `docs/VICTOR-TODO-ISO-06-STRIDE-APP-FLIP.md` — DATABASE_URL → stride_app
3. Run `scripts/audit-default-org-memberships.ts` before/after deploy
4. Apply migration `20260627130000_system_setting_composite_key` on Neon before deploy
