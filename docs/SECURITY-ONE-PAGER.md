# Stride — Security One-Pager (G6 / RAV-126)

**Last updated:** 25 Jun 2026  
**Scope:** Application-layer controls beyond PostgreSQL RLS (Phase 0).  
**Related:** G2 compliance posture, `docs/MULTI-TENANT-REFERENCE.md`, `npm run audit:module-tenant`

---

## 1. Trust boundaries

| Layer | Control |
|-------|---------|
| **Data** | Row-level security on tenant tables; `organizationId` on models; `withTenant()` on staff APIs |
| **Session** | HttpOnly `staff_session` / `ess_session` cookies; `secure` in production |
| **Module licensing** | `MODULE_*` env + middleware route guards + `requireModule()` on APIs |
| **Account billing** | Past-due read-only middleware; entitlement cookies from control plane |

---

## 2. Authentication & rate limiting

- **Staff login:** `POST /api/auth/login` — domain allowlist, bcrypt, MFA challenge when enabled, audit events on success/failure.
- **ESS login:** `POST /api/ess/auth/login` — same audit pattern.
- **Rate limit:** 10 attempts / 15 min / IP on both login routes (middleware + `src/lib/rate-limit.ts`). Upgrade to Redis/KV for multi-region scale.
- **Cron / provision:** `CRON_SECRET`, `STRIDE_CELL_PROVISION_KEY` — required in production.

---

## 3. Authorization

- Staff APIs: `requireStaffUser()` or `withTenant()` (preferred for tenant-scoped data).
- ESS APIs: `requireEssUser()` + employee ownership checks on payslips, bank details, etc.
- Admin mutations: `requireAdminActor()` + optional `requireRecentSensitiveAuth()` for destructive ops.
- **Audit script:** `npm run audit:api-auth` — fails CI if new routes lack recognized guards.

---

## 4. Sensitive data access logging

Actions logged to `AuditEvent` via `logSensitiveFieldAccess()`:

| Field group | Example routes |
|-------------|----------------|
| `payslip` | `GET /api/ess/payslips/[id]/pdf` |
| `bank_details` | `GET /api/ess/pay/bank-change` |

Extend to staff payroll exports and employee PII edits as those surfaces harden.

---

## 5. File uploads

- **PDF only** for resumes and employee documents.
- **Magic-byte validation** (`%PDF-`) in `src/lib/file-upload-validation.ts` — not MIME header alone.
- **Max size:** 4.5 MB (Vercel body limit).
- **Auth:** `/api/upload/document` requires staff or ESS session; public careers resume upload is intentionally unauthenticated (candidates).

---

## 6. HTTP security headers

Applied on all middleware responses (`src/lib/security-headers.ts`):

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restrict camera/mic; geolocation self for attendance)
- `Strict-Transport-Security` in production

---

## 7. Secrets & configuration

- All secrets via environment variables (Vercel sensitive env). Never commit `.env.local`.
- Documented in `.env.example`: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `MPESA_*`, `MODULE_*`, `CRON_SECRET`, `STRIDE_CELL_PROVISION_KEY`.
- Demo mode (`DEMO_MODE`) bypasses module licensing — **must be false on paid client cells**.

---

## 8. Dependencies & build quality

| Check | Command | Launch status |
|-------|---------|---------------|
| Dependency audit | `npm audit` | 31 known issues (Jun 2026) — run `npm audit fix` for safe updates; exceljs/uuid needs planned upgrade |
| API auth scan | `npm run audit:api-auth` | Run in CI |
| Tenant gate | `npm run audit:module-tenant` | Run before module releases |
| TypeScript strict | `npm run typecheck` | ~800 errors remain — enable `STRICT_BUILD=true` on Vercel when cleared |
| ESLint | `npm run lint` | Enable with `STRICT_BUILD=true` |

`next.config.js` respects `STRICT_BUILD=true` to fail builds on TS/ESLint errors. Default remains permissive until debt is burned down.

---

## 9. Pre-launch checklist (paid clients)

- [ ] `DEMO_MODE=false`, production `STAFF_ALLOWED_DOMAIN` set
- [ ] `CRON_SECRET` and provision keys rotated
- [ ] `npm run audit:api-auth` && `npm run audit:module-tenant` pass
- [ ] `npm audit` — no critical/high in production dependency tree
- [ ] Enable `STRICT_BUILD=true` on production Vercel project
- [ ] RLS verified on Neon (`npm run test:rls`)

---

## 10. Known follow-ups

1. Distributed rate limiting (Vercel KV / Upstash Redis).
2. Staff payslip PDF + payroll export sensitive logging.
3. Content-Security-Policy header (tune for Next.js inline scripts).
4. TypeScript strict build — track error burn-down to zero.
