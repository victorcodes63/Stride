# Build Blueprint — Multi-Tenant HRIS + Finance Mini-ERP

**Working product name:** _TBD_ (candidates: Msingi / Imara — decide before Phase 0; the repo, schema, and docs reference it everywhere). This doc uses **`platform`** as the placeholder.

**Owner:** Victor — Raven Tech Group
**Target market:** Kenyan SMEs / mid-market first → Uganda, Tanzania later
**Goal of this build:** A demo-ready, multi-tenant product that makes a Kenyan prospect say _"this runs my company."_ Not the full ERP — a tight, compliant, sellable core.
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Framer Motion · Neon Postgres · Drizzle ORM · Auth.js v5 · Zod · Vercel
**Execution environment:** Cursor (same LLM). Designed for sequential execution by one agent OR parallel execution by multiple agents (see §Parallel Execution Rules).

---

## 0. Read This First — Non-Negotiable Principles

1. **One configurable core, never forks.** Client differences live in config/data, never in branched code. (This is the whole point — we are building a platform, not bespoke builds.)
2. **Multi-tenant from line one.** Every domain table carries `organization_id`. Postgres Row-Level Security (RLS) enforces isolation. No query ever trusts the app layer alone.
3. **Money is integer minor units.** Store all monetary values as `bigint` cents (KES has no decimals in practice but payroll math needs precision). Never use floats. Format only at the view layer.
4. **Statutory rates are config, not constants.** PAYE bands, SHIF %, NSSF tiers, housing levy — all live in a versioned `statutory_config` table keyed by country + effective date. Kenya today, Uganda/Tanzania later = new config rows, not new code.
5. **Timezone is `Africa/Nairobi`.** Store UTC, render Nairobi. Payroll periods, leave dates, attendance all assume this.
6. **Demo on fictional seed data.** A believable Kenyan SME (~40 staff, 2–3 departments, one payroll run, sample invoices). NEVER Eagle's live data.
7. **Definition of Done per phase = it demos cleanly end-to-end.** A half-built module on screen loses deals.

---

## 1. Architecture Spine (build once, everything hangs off it)

### Tenancy model
- **Shared schema, row-level isolation.** Single database, single set of tables, `organization_id` on every business row.
- **Postgres RLS** policies on every tenant table: `USING (organization_id = current_setting('app.current_org')::uuid)`.
- App sets `app.current_org` per request from the authenticated session. One missed policy = a data leak, so RLS is mandatory on every new table — make it a checklist item.

### Core tables (Phase 0)
| Table | Purpose |
|---|---|
| `organizations` | The tenant. Name, country, currency, settings JSONB. |
| `users` | Global identity (one human, may belong to many orgs). |
| `memberships` | user ↔ organization, carries `role`. |
| `roles` / `permissions` | RBAC. Seed: Owner, Admin, HR, Finance, Manager, Employee. |
| `audit_log` | who/what/when/before/after on every mutating action. |
| `statutory_config` | country + effective_date keyed rates (see §Payroll). |

### Folder structure (enables parallel agents — see §Parallel Execution Rules)
```
/src
  /core            # tenancy, auth, db, rls, shared types — Phase 0, FROZEN after
    /db            # drizzle schema (single source of truth)
    /auth
    /rbac
    /lib           # money, dates, formatting, audit helpers
  /modules
    /people        # employees, departments, contracts
    /payroll       # payroll runs + statutory engine
    /leave
    /attendance
    /finance       # COA, AR, AP, M-Pesa recon
    /ess           # employee self-service
    /dashboard
  /app             # Next.js routes — route group per module
    /(app)/people/...
    /(app)/payroll/...
    ...
  /components/ui   # shadcn — shared, FROZEN after Phase 0 setup
```
Each module owns its folder under `/modules` and its route group under `/app`. Agents do not edit each other's folders. Shared contracts (`/core/db`, `/components/ui`) are defined in Phase 0 and changed only via a deliberate, single-owner update.

---

## 2. Phased Plan

### Dependency map (what unlocks parallelism)
```
Phase 0 (Foundation) ──► Phase 1 (People = system of record)
                                  │
                 ┌────────────────┼─────────────────┐
                 ▼                ▼                 ▼
        Phase 2A Payroll   Phase 2B Leave    Phase 2C Finance
        (+Statutory)       (+Attendance)     (mostly independent)
                 └────────────────┼─────────────────┘
                                  ▼
                   Phase 3 (Dashboard · ESS · Seed · Polish)
```
**Phase 0 and Phase 1 are sequential and blocking.** After Phase 1, 2A/2B/2C run in parallel. Phase 3 integrates.

---

### PHASE 0 — Foundation `[SEQUENTIAL · single agent · blocking]`
**Objective:** A running multi-tenant Next.js app where a user can sign up, create/join an organization, log in, see an empty authenticated dashboard shell, and every future table inherits tenancy + RLS + audit by default.

**Build:**
1. Next.js 14 App Router + TS + Tailwind + shadcn/ui + Framer Motion scaffold. Connect Neon. Drizzle configured with migrations.
2. Core schema (§1 tables) + RLS policies + the `app.current_org` session-setting mechanism.
3. Auth.js v5: email/password (+ optional Google later). Session carries `userId`, `currentOrgId`, `role`.
4. Org onboarding flow: create org → becomes Owner; invite/join flow stub.
5. RBAC middleware + a `can(permission)` helper used by all modules.
6. Audit helper: a single `withAudit()` wrapper for all mutations.
7. App shell: sidebar nav (mirror the Eagle layout pattern but generic), org switcher, top bar, responsive.
8. `money.ts` (cents ↔ display), `dates.ts` (Nairobi-aware), Zod base schemas.

**Definition of Done:** Two separate orgs can be created; data created in Org A is provably invisible to Org B (RLS verified with a test); audit log records actions; empty module nav renders.

**Cursor note:** Do this phase yourself or with ONE agent. Do not parallelize. Everything downstream depends on the schema and helpers being stable. Tag a git commit `phase-0-complete` and treat `/core` as frozen.

---

### PHASE 1 — People / Employee Management `[SEQUENTIAL after P0 · single agent · semi-blocking]`
**Objective:** The HR system of record. Payroll, Leave, Attendance all reference employees, so this comes before them.

**Data model (`/modules/people`):**
- `departments` (org-scoped, tree-capable via `parent_id`)
- `job_titles`
- `employees` — personal info, national ID, KRA PIN, NSSF no., SHIF/SHA no., bank + M-Pesa details, hire date, status (active/terminated/on-leave)
- `employment_contracts` — type (permanent/contract/casual), start/end, gross salary (cents), pay frequency
- `employee_documents` — file refs (contracts, IDs)

**Screens:** Employee list (search/filter/paginate) · employee profile (tabs: personal, employment, documents, payroll info) · create/edit employee · departments & job titles admin · bulk CSV import (reuse your Eagle import experience).

**Definition of Done:** Can add/edit/list employees in the seed org, assign departments & contracts, import a CSV of staff. Profile shows everything payroll will need (PIN, NSSF, SHIF, salary, bank/M-Pesa).

**Cursor note:** Commit `phase-1-complete`. After this, branch into three parallel tracks.

---

### PHASE 2A — Payroll + Statutory Engine `[PARALLEL · dedicated agent · HARDEST MODULE]`
**This is the kill shot. Give it your strongest focus / a dedicated agent.**

**Data model (`/modules/payroll`):**
- `statutory_config` — `country`, `effective_from`, `effective_to`, `config` JSONB (PAYE bands, reliefs, SHIF %, NSSF tiers/limits, housing levy %, NITA). **Versioned by date.**
- `pay_periods` — org, month/year, status (draft/processing/approved/paid)
- `payroll_runs` — links pay_period; totals
- `payslips` — per employee per run: gross, each earning, each deduction, each statutory line, net
- `payslip_lines` — itemized (earnings, deductions, statutory) for full traceability

**Statutory calc engine (`/modules/payroll/statutory/kenya.ts`):**
Pure functions, input = gross + employee facts, output = itemized deductions. Driven entirely by `statutory_config`. Implement for Kenya:
- **PAYE** — graduated bands + personal relief + insurance/pension reliefs.
- **SHIF** (Social Health Insurance Fund, under SHA — replaced NHIF) — % of gross.
- **NSSF** — Tier I & Tier II on pensionable earnings limits (employee + employer).
- **Affordable Housing Levy** — % of gross (employee + employer match).
- **NITA** — flat per employee/month.

> ⚠️ **VERIFY ALL RATES BEFORE CODING.** Rates/bands/limits change frequently and this accuracy IS your competitive moat. Treat the values you seed as config to confirm against current KRA / SHA / NSSF positions, not as gospel. (Ask Claude to pull current published rates before you finalize the Kenya `statutory_config` seed.)

**Outputs:** Run payroll for a period → generate payslips → payslip PDF → P9 (annual) → statutory return export files (PAYE/SHIF/NSSF/Housing). Approval workflow (draft → approve → mark paid).

**Definition of Done:** Run a full monthly payroll on the ~40 seed employees, produce correct itemized payslips + a downloadable payslip PDF + at least one statutory return export, with an approval step. Numbers must be defensibly correct.

---

### PHASE 2B — Leave + Attendance `[PARALLEL · dedicated agent]`
**Leave (`/modules/leave`):**
- `leave_types` (annual, sick, maternity, etc. — configurable per org, with accrual rules)
- `leave_balances` (per employee per type per year)
- `leave_requests` (dates, reason, status, approver) + approval workflow
- Screens: my leave / request leave / approvals queue / leave calendar / balances admin.

**Attendance (`/modules/attendance`) — lighter for demo:**
- `attendance_records` (employee, date, clock-in/out, source)
- Manual + CSV entry for v1. **Defer biometric hardware integration** (ZKTeco/Hikvision) to post-demo — architect an `import source` field so the device adapter slots in later without schema change.

**Definition of Done:** Employee can request leave, manager approves, balance decrements, calendar shows it. Attendance can be entered manually and listed.

---

### PHASE 2C — Financial Accounting (core) `[PARALLEL · dedicated agent · mostly independent of People]`
**You already have most of this in Eagle — generalize it.**

**Data model (`/modules/finance`):**
- `chart_of_accounts` (org-scoped, account types: asset/liability/equity/income/expense)
- `clients` / `vendors`
- `invoices` + `invoice_lines` (AR), `credit_notes`, `receipts` (+ allocations)
- `expenses` / `bills` (AP), basic `payments`
- `mpesa_transactions` + reconciliation matching (THE regional differentiator)

**Screens:** COA admin · invoices (create/send/track) · receipts & allocation · expenses · **M-Pesa reconciliation** (import statement / paybill records → auto-match to invoices/receipts) · simple P&L + cash position.

**Definition of Done:** Create an invoice, record a receipt against it, log an expense, and demonstrate M-Pesa reconciliation matching a payment to an invoice. Basic P&L renders.

> Note: full double-entry GL is overkill for the demo. Do clean AR/AP + M-Pesa recon now; layer formal double-entry GL post-demo. Flag this as a known scope boundary.

---

### PHASE 3 — Dashboard · ESS · Seed · Polish `[INTEGRATION · sequential after 2A/2B/2C merge]`
**Dashboard (`/modules/dashboard`):** The demo landing screen. Headcount, monthly payroll cost, statutory liabilities, leave on today, cash/AR position. Make it the strongest visual screen — first impressions close demos.

**ESS (`/modules/ess`):** Employee-facing portal — view/download payslips, request leave, view profile. High perceived value, strong "and your staff get this too" demo moment. Thin but real.

**Seed data:** Script a fictional Kenyan SME — ~40 employees across 2–3 departments, contracts, one approved payroll run with payslips, sample invoices/receipts/expenses, some leave requests. This is what every demo runs on.

**Polish:** Framer Motion transitions, empty states, loading states, mobile responsiveness, consistent branding (and the product NAME, finally committed).

**Definition of Done:** A clean end-to-end demo path: log in → dashboard → browse employees → run/show a payslip → show leave approval → show an invoice + M-Pesa match → show the employee ESS view. No dead ends, no half-built screens.

---

## 3. Parallel Execution Rules (for multiple Cursor agents)

The #1 risk with parallel agents is collision on shared files. Enforce:

1. **Phase 0 first, by one agent, then freeze `/core` and `/components/ui`.** The Drizzle schema is the single source of truth and the most dangerous shared file.
2. **One agent per module folder.** Agent owns `/modules/<x>` and `/app/(app)/<x>`. It does not touch other modules' folders.
3. **Schema changes go through one owner.** If a parallel agent needs a new table, it adds it in its own module's schema file (Drizzle supports split schema files), never edits another module's tables. Coordinate the migration.
4. **Shared types are imports, not edits.** Agents import from `/core`; they don't modify it. If `/core` must change, pause parallel work, make the change once, re-sync.
5. **Branch per module, frequent merges.** `feat/payroll`, `feat/finance`, etc. Merge to a `develop` branch at each phase boundary. Resolve conflicts at the seams (mainly nav registration + dashboard data hooks).
6. **A shared `nav.config.ts`** registry where each module declares its nav entry — append-only, so agents add a line rather than editing a monolithic sidebar.

If you can't run agents truly in parallel, this same structure lets one agent execute 2A → 2B → 2C sequentially with zero rework, because the boundaries are already clean.

---

## 4. Cursor Execution Notes

- **Keep this file in the repo** (`/docs/BUILD-BLUEPRINT.md`) and reference it in your prompts: _"Follow /docs/BUILD-BLUEPRINT.md, Phase 2A."_
- **Add a `.cursorrules`** capturing the non-negotiables in §0 (multi-tenant + RLS on every table, money as cents, Nairobi timezone, statutory rates from config) so every generation respects them.
- **One phase per chat/agent session.** Don't let an agent wander across phases — it blurs boundaries and creates collisions.
- **Commit at every Definition of Done** with the phase tag. Never start a parallel phase before `phase-0-complete` and `phase-1-complete` exist.
- **Verify, don't trust, generated payroll math.** Hand-check the statutory calcs against a known correct payslip before you ever demo.

---

## 5. Explicit Scope Boundaries (what we are NOT building for the demo)

- Full double-entry general ledger (AR/AP + M-Pesa recon only for now).
- Biometric hardware integration (architected for, not built).
- Recruitment/ATS as a hero feature (exists as a stub tab at most).
- The Eagle-specific "Outsourcing" module and multi-client payroll structure (that's an HR-consultancy vertical pack for later, not the core market product).
- Uganda/Tanzania statutory packs (config rows added once Kenya is proven).

---

## 6. Suggested Sequence Summary

| Phase | What | Mode | Blocking? |
|---|---|---|---|
| 0 | Foundation (tenancy, auth, RLS, shell) | 1 agent | Yes |
| 1 | People / employees | 1 agent | Yes |
| 2A | Payroll + statutory engine | parallel agent | No |
| 2B | Leave + attendance | parallel agent | No |
| 2C | Finance (AR/AP + M-Pesa recon) | parallel agent | No |
| 3 | Dashboard · ESS · seed · polish | 1 agent (integrate) | Yes |

**Fastest path to a demo:** 0 → 1 → (2A‖2B‖2C) → 3.
**The module that wins the deal:** 2A (payroll + correct Kenyan statutory compliance). Protect its quality above all else.
