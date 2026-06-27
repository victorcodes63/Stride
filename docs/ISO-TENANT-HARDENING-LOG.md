# Tenant Isolation Hardening — AUTO-RUN-LOG

Branch: `iso/tenant-hardening` (app repo) — **not pushed to main**

| Issue | Status | Notes |
|-------|--------|-------|
| RAV-245 ISO-01 | done | `deployment-cell.ts`; VICTOR TODO env split |
| RAV-246 ISO-02 | done | No auto-attach on customer cell |
| RAV-247 ISO-03 | done | High-traffic routes + all `/api/reports/*` |
| RAV-248 ISO-04 | done | **277/277 routes (100%)** tenant-wrapped |
| RAV-249 ISO-05 | done | SystemSetting composite PK + all loader/seed updates |
| RAV-250 ISO-06 | handoff | VICTOR TODO only — no DB role flip |

## Verify log (deploy 2026-06-27)

| Check | Result |
|-------|--------|
| `npm test -- --run deployment-cell org-membership` | 6/6 pass |
| `npm run audit:module-tenant` | 277/277 (100%) |
| `npm run test:rls` | PASS (owner URL for setup) |
| `npm run test:cross-tenant` | PASS |
| `audit-default-org-memberships.ts` | 30 default-org memberships; 4 dual-org (review) |
| Vercel production deploy | https://app.getstride.co.ke — READY |
| ISO-01 demo vars stripped | ✓ production env |
| ISO-06 stride_app flip | ✓ DATABASE_URL on Vercel production |

## Commits (newest first)

- RAV-248/249 finish: remaining assets/ESS routes + SystemSetting seed helper
- RAV-249: SystemSetting composite key
- RAV-248: core + ats/leave/time/vertical + accounts batches
- RAV-247: high-traffic routes
- RAV-246: ensureDefaultMembership gate
- RAV-245: demo branding fallbacks removed

## VICTOR TODOs (manual — deploy sequence)

1. Merge `iso/tenant-hardening` → main (review first)
2. **ISO-01 env split:** `docs/VICTOR-TODO-ISO-01-DEMO-SPLIT.md` — demo.getstride.co.ke vs app.getstride.co.ke
3. **Apply migration on Neon:** `prisma migrate deploy` (includes `20260627130000_system_setting_composite_key`)
4. Deploy to Vercel
5. Run verification on staging/production:
   - `npm run test:rls`
   - `npm run test:cross-tenant`
   - `npx tsx scripts/audit-default-org-memberships.ts`
6. **ISO-06 stride_app flip (after verify):** `docs/VICTOR-TODO-ISO-06-STRIDE-APP-FLIP.md`
   - Rollback script: `scripts/restore-production-owner-database-url.mjs`
