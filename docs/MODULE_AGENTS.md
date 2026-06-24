# HRIS Demo — parallel module handoff

**Repo root:** project root (this folder)  
**Dev server:** `npm run dev` → [http://localhost:3000](http://localhost:3000)  
**Logo / brand:** raster or SVG under `public/brand/` (see `src/lib/brand.ts` and `NEXT_PUBLIC_BRAND_LOGO`)

Use this file to assign **separate PRs or Cursor agents** to a **single workstream** each. Merge order follows dependencies in §**Execution order**.

---

## Workstream index


| ID  | Module                          | Owns (paths)                                                                                                                                                | Depends on                                            | Blocks                      |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------- |
| A0  | **Branding + shell**            | `src/app/layout.tsx` metadata, login/dashboard layout, `package.json` name, `README` header, `lib/email.ts` + `payslip-pdf` header/footers, favicon         | —                                                     | Public-facing work          |
| A1  | **Public surface trim**         | Delete extra marketing; keep `/careers` + medical jobs filter, `/dashboard/login`; `src/app/page.tsx` → redirect `/` → `/careers`; strip nav to Staff login | —                                                     | A0 for strings/assets       |
| B1  | **Auth: Microsoft + Google**    | New Google OAuth routes + env; keep MS routes; `AUTH.md` / `.env.example`                                                                                   | —                                                     | ESS, sensitive APIs         |
| C1  | **Outsourcing → single tenant** | `prisma` + `/api/employees` `/api/payroll` (rename from `outsourcing/`*), backfill one org                                                                  | DB access                                             | C2, payroll UI              |
| C2  | **Leave promote**               | `prisma` merge `StaffLeave`* with employee leave + `/api/leave`                                                                                             | C1 (if shared User/Employee)                          | ESS leave                   |
| D1  | **M1 Biometric**                | `lib/biometric/`, `BiometricDevice` models, cron `biometric-poll`, `POST /api/biometric/import`                                                             | C1 `Employee`                                         | D2, M2                      |
| D2  | **M2 Shift engine (pure)**      | `lib/shift-engine/`**, **tests R1–R7 first**, no Prisma inside engine                                                                                       | D1 types for `BiometricPunch` shape (or shared types) | D3, payroll calc wiring     |
| D3  | **M3 Rota**                     | `lib/rota/import-adapter`, `/api/rota/`*, `ShiftTemplate` / `RotaPeriod` / `ShiftAssignment`                                                                | C1                                                    | D2 assignments              |
| D4  | **M2 + payroll integration**    | `AttendanceRecord` / `OvertimeRecord` Prisma, wire `payroll-calc`                                                                                           | D2, C1                                                | Finance reports             |
| D5  | **M4 Credentials + cron**       | `EmployeeCredential`, extend contract/credential reminders                                                                                                  | C1                                                    | Overview                    |
| E1  | **P3 Security**                 | `sensitive-fields.ts`, `SensitiveFieldAccessLog`, RBAC, TOTP, password policy                                                                               | B1, roles in Prisma                                   | E2, all APIs                |
| E2  | **P2 ESS**                      | `employee-portal-users`, separate cookie, middleware, v1 pages                                                                                              | B1, C2, D3–D4 subset                                  | —                           |
| F1  | **P4 Dashboard overview**       | `/dashboard` stats cards                                                                                                                                    | C2, D3–D5, accounts kept                              | —                           |
| G1  | **Accounts (keep v1)**          | Rebrand only; no delete — align copy with product branding, shared HR/finance                                                                                | A0                                                    | F1 if metrics pull accounts |


**Excluded (do not build):** data-ownership page, client-references (per product scope).

---

## Conflicts to avoid (same-file edits)

- **Prisma `schema.prisma`:** one owner at a time; use ordered migrations (Q23).
- `**src/middleware.ts`:** A1 + E2 + B1 will both touch it — **serialize** or merge in one PR after cookie names are agreed.
- `**DashboardNav.tsx`:** A1 + F1 — one PR or coordinate sections.

---

## Suggested agent prompts (copy-paste)

**Agent — M1 biometrics**  

> In this repository, implement M1: `lib/biometric/` with `BiometricAdapter` interface, `HikvisionIsapiAdapter` stub, append-only `BiometricPunch` + `BiometricDevice` in Prisma (migration with additive-first order), `GET` cron `api/cron/biometric-poll` (config interval default 60s), `POST api/biometric/import` CSV. Follow docs in parent chat. Do not change payroll-calc math.

**Agent — M2 shift engine**  

> In this repository, own `lib/shift-engine/`: pure functions only, R1–R7 rules from MODULE_AGENTS / parent spec. Write Vitest tests before implementation. No Prisma imports in engine.

**Agent — M3 rota**  

> Add `ShiftTemplate`, `RotaPeriod`, `ShiftAssignment` models (additive migration), `lib/rota/import-adapter.ts` for CSV, `/api/rota/`* routes, `/dashboard/rota` UI skeleton. Conflict detection: 8h rest, 60h/week with hooks for per-role later.

**Agent — Branding (A0)**  

> Rebrand complete: assets in `public/brand/`, product name **HRIS Demo** (override via `NEXT_PUBLIC_APP_NAME`). Email templates, payslip PDF header, and login use configured assets. No legacy vendor strings in application source (migrations history excluded).

**Agent — Public trim (A1)**  

> Remove marketing routes per decision; public routes = careers (medical jobs) + login; `src/app/page.tsx` redirects to `/careers`. Keep ATS dashboard code.

**Agent — Google OAuth (B1)**  

> Add Next.js App Router Google OAuth (parallel to existing Microsoft in `api/auth/`), document env vars in `AUTH.md` and `.env.example`.

---

## Execution order (merge queue)

1. A0 (branding baseline) can parallel with A1 (routes) with care on `layout`.
2. C1 (tenant flatten) before D1/D3/D4.
3. D2 (engine + tests) before D4.
4. D1 can parallel D3 once `Employee` ids stable.
5. E1 before widening ESS (E2).
6. F1 last after data paths exist.

---

*Last updated: HRIS Demo — dev server: `npm run dev`.*