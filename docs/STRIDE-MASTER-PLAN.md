# Stride — Master Plan (Single Source of Truth)

> **This document supersedes all earlier roadmap/plan/blueprint docs.** If anything elsewhere
> contradicts this file, **this file wins.** It is the one doc Cursor and any agent should read
> before starting work. Every unit of work here maps 1:1 to a Linear issue (see `LINEAR-IMPORT.md`).

**Product:** Stride — the operating system for East African business
**Marketing site:** https://www.getstride.co.ke
**Repo:** `Stride/`
**Owner:** Victor — Raven Tech Group
**Last updated:** 23 June 2026
**Status of this doc:** Canonical. Update §3 (Current state) and §6 (Phases) as work ships.

> **⚠️ Architecture reversal (23 June 2026):** Stride is now **pooled multi-tenant by default,
> sharded into regional cells, with dedicated single-tenant reserved for enterprise.** This
> reverses the earlier "dedicated-only, never multi-tenant" decision. Reason: the dedicated-per-client
> model does not scale economically or operationally for subscription clients, and multi-tenant +
> regional cells is the industry-standard path for both scaling and country expansion (KE → UG → TZ →
> rest of Africa). See §2. We re-found the platform **in place**: build the tenant-safe core first
> (Phase 0), then migrate existing modules onto it.

---

## 0. How to use this document (read first)

1. **One plan, one truth.** This file replaces `PRODUCT-MASTER-PLAN.md` (phases 0–9),
   `module-roadmap.md` (phases A–F), and `BUILD-BLUEPRINT.md` (the old multi-tenant model).
   Those are archived. Do not follow them.
2. **The architecture is settled** — see §2. We are **pooled multi-tenant on Prisma**, sharded into
   **regional cells**, with **dedicated single-tenant** as an enterprise option. Every domain table
   carries `organizationId` and is protected by Postgres row-level security (RLS). Any doc describing
   a *dedicated-only, no-tenant_id* model is **obsolete**.
3. **The name is settled** — the product is **Stride**. "Backbone HR", "Msingi", "Imara", and "TBD"
   are dead names. Replace on sight; never introduce.
4. **Work flows through Linear.** Each numbered workstream below is a Linear issue (team `RAV`) under
   a phase Project. Cursor should be told: _"Work Linear issue RAV-NN. Follow `docs/STRIDE-MASTER-PLAN.md`."_
5. **Definition of Done is non-negotiable** — see §4. A module is not "done" because the UI renders;
   it is done when it meets all eight criteria.

---

## 1. Product vision

Stride is an all-in-one business operating system for Kenyan and East African companies —
HR, payroll, finance, and operations — delivered as a **pooled multi-tenant subscription** on
**regional cells** (with **dedicated instances** for enterprise), sold by **module**, with **deep
local compliance** (KRA, SHIF, NSSF, Housing Levy, M-Pesa) as the moat.

| Principle | Decision |
|-----------|----------|
| **Deployment** | **Pooled multi-tenant** by default (many orgs per cell), **regional cells** for residency, **dedicated single-tenant** for enterprise. One codebase. |
| **Audience** | Subscription SMBs (pooled) + enterprise/regulated clients (dedicated); HR outsourcers; logistics as first vertical. |
| **Edge** | Built by HR practitioners; deep local compliance per country (config packs), workflows and billing that match how EA business is run. |
| **Pricing** | Transparent modular subscription (Starter/Growth/Enterprise); entitlements enforced by the control plane (see §8). |
| **Scope** | Full lifecycle: hire → onboard → time → pay → perform → develop → exit → bill. |

**What we are NOT building (v1):** a separate statutory *engine* per country (countries are **config
packs**, not forks); payroll financing without a lending partner; native mobile apps (PWA-first ESS);
a separate codebase per region (regions are **deployment cells** of one codebase).

---

## 2. Architecture truth (settled — do not relitigate)

Stride is **one codebase** deployed as **regional cells**. Each cell is a pooled multi-tenant
deployment hosting many client organizations. Enterprise clients who require isolation get a
**dedicated** deployment of the same codebase. Everything is governed by **one control plane**.

```
                       ┌───────────────────────────────────────────┐
                       │            Stride Control Plane            │
                       │  customers · subscriptions · entitlements  │
                       │  billing · fleet sync · provisioning       │
                       └───────────────────────────────────────────┘
                          │ sync (entitlements / health / releases)
        ┌─────────────────┼──────────────────────┬───────────────────────┐
        ▼                 ▼                      ▼                       ▼
 ┌───────────────┐ ┌───────────────┐    ┌───────────────┐     ┌───────────────────┐
 │  KE cell      │ │  UG cell      │ …  │  TZ cell      │     │ Enterprise (Acme) │
 │ pooled MT     │ │ pooled MT     │    │ pooled MT     │     │ dedicated, 1 org  │
 │ many orgs     │ │ many orgs     │    │ many orgs     │     │ own DB/domain     │
 │ Neon (KE)     │ │ Neon (UG)     │    │ Neon (TZ)     │     │ Neon (region)     │
 │ org_id + RLS  │ │ org_id + RLS  │    │ org_id + RLS  │     │ org_id + RLS      │
 └───────────────┘ └───────────────┘    └───────────────┘     └───────────────────┘
   *.getstride.co.ke / hr.<client>.co.ke              hr.acme.co.ke
```

### Non-negotiable principles
- **Multi-tenant from line one.** Every domain table carries `organizationId`. **Postgres RLS** on
  every tenant table: `USING (organization_id = current_setting('app.current_org')::uuid)`. The app
  sets `app.current_org` per request from the session. **One missed policy = a data leak** — RLS is a
  mandatory checklist item on every new table. Dedicated deployments use the *same* tenant-safe schema
  (they simply hold one org), so there is exactly one code path.
- **Regional cells for residency + latency.** A cell = one deployment + one regional database hosting
  many orgs. KE, UG, TZ are first-class. **Adding a country/region = stand up a cell + load a config
  pack. No code fork.** Rwanda and the rest of Africa follow the same recipe.
- **Country is pure config.** Statutory rules (PAYE/SHIF/NSSF/Housing Levy or each country's
  equivalent), currency, public holidays, locale, language live in **versioned config keyed by
  country + effective date** — never hard-coded, never branched.
- **One control plane over everything.** Source of truth for who-paid-for-what across all cells and
  dedicated instances. Owns: provisioning, entitlement sync, fleet releases/migrations, health
  monitoring, billing status, backup verification.
- **Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · **Prisma** · Neon Postgres · Auth.js · Vercel.
- **Money:** integer minor units (cents). Never floats. Format at the view layer only.
- **Timezone:** store UTC, render in the org's timezone (default `Africa/Nairobi`).
- **Entitlements:** `effectiveModule = entitled ∧ envLicensed ∧ adminEnabled ∧ accountActive`
  (see `ENTITLEMENT-SYNC.md`). Control plane is the source of truth; cells fall back to cached
  entitlements, then `MODULE_*` env, if it is unreachable.

### Tenancy vocabulary (use precisely)
- **Cell** — a deployment + regional DB; pooled, hosts many orgs (e.g. `KE cell`).
- **Organization (tenant)** — one client company; the `organizationId` boundary. RLS isolates it.
- **Legal entity** — a sub-unit of one org (a company's KE + UG branches). Entity switcher scopes
  payroll/employees *within* an org. **Not** a tenant boundary.
- **Dedicated instance** — a cell that holds exactly one org, for an enterprise client.

> **Re BUILD-BLUEPRINT.md (archived):** its multi-tenant / `organization_id` / RLS instinct was
> **correct** and is now the model. We keep **Prisma** (not its Drizzle suggestion). Treat it as
> historical context only; this section is authoritative.

### Deployment topology (Vercel, team `rtgprojects`)
One Stride codebase feeds two Vercel projects; the control plane is a **separate app**.

| Project | Domain | Role | Source |
|---------|--------|------|--------|
| `stride-app` | `getstride.co.ke` | Marketing/public site | Stride repo |
| `stride-platform` | `app.getstride.co.ke` | **KE cell** — pooled multi-tenant product | Stride repo |
| `stride-control-plane` | `admin.getstride.co.ke` (private) | Internal control plane | **separate repo + own DB** |
| `stride-platform-ug` / `-tz` … | per region | Additional cells (as we expand) | Stride repo |
| per-client | `hr.<client>.co.ke` | Enterprise dedicated instances | Stride repo |

**The control plane is NOT a route inside the Stride app.** It is Raven-internal, has its **own
database** (customers, subscriptions, billing) and **restricted access**, and governs entitlements/
provisioning across all cells via `ENTITLEMENT-SYNC.md`. It must never be reachable as a tenant app.
The empty legacy `hris-demo` Vercel project is retired. Cutover steps: `docs/STRIDE-CUTOVER-RUNBOOK.md`.

### Canonical codebase decision (24 June 2026)
The local workspace held **two** product codebases. Settled:
- **`hris-demo` (Prisma, feature-rich) is the canonical Stride product.** All build work happens here.
  Multi-tenancy is added to it in place (Phase 0 / RAV-62).
- **`platform` (Drizzle) is a reference only** — it already built + verified a working multi-tenant
  core (RLS, `app.current_org`, isolation test). We **mine its patterns** for RAV-62 (see
  `docs/MULTI-TENANT-REFERENCE.md`) — RLS is ORM-agnostic — then **archive `platform/`**. We do NOT
  re-port Stride's ~136 pages / 228 APIs onto Drizzle.
- **`control-plane`** stays (the separate internal app per the topology above).

Rationale: adding `org_id` + RLS to the mature Prisma app is a bounded retrofit; re-implementing the
full feature set on the bare Drizzle platform is months of regression risk. Keep the features, borrow
the tenancy core.

---

## 3. Current state snapshot (baseline — update when a phase exits)

> **✅ RE-BASELINED 24 Jun 2026 against real `app/` code** (RAV-111 done). App scale: **168 pages,
> 249 API routes, 114 Prisma models** — large and mature. Only **one genuine mock page** exists
> (`performance`). See `docs/STRIDE-ISSUE-AUDIT.md` for the per-issue verdicts.

Legend: 🟢 Ship (sell/demo today) · 🟡 Partial / verify · 🔴 Mock / not built

| Area | Status | Verified notes (pages/APIs) |
|------|--------|------------------------------|
| Platform, branding, provisioning | 🟢 | Env brand, demo vs production seed, runbook, smoke tests |
| Module licensing + entitlements | 🟢 | `MODULE_*` flags (19 modules), middleware, control-plane sync |
| Auth & security | 🟢 | Staff + ESS sessions, MFA, RBAC, audit log |
| Core HR / employees / org | 🟢 | people 5/4, employees, departments, org-chart |
| Onboarding / offboarding | 🟢 | onboarding 2/4, hire-from-ATS |
| Leave | 🟢 | ESS leave + staff-leave + outsourcing; **routing quirk only** (A3) |
| Rota, attendance, biometrics | 🟢 | rota 1/9, 6 attendance models, biometric-devices |
| Geo mobile clock-in | 🔴 | Not built |
| Payroll (Kenya) + statutory | 🟢 | payroll 4/2 + lib + statutory page; Payroll model |
| M-Pesa disbursement | 🟡 | ~9 M-Pesa/disburse refs exist; **bulk-transfer gap** — verify then build (A1) |
| Recruitment / ATS | 🟢 | jobs 3/4, candidates 1/4, applications 1/8, interviews 2/12 |
| Candidate assessments | 🔴 | Scorecards only |
| Performance management | 🔴 | **Only true mock page** — no model/API (A2) |
| Disciplinary & grievance | 🟢 | disciplinary 3/7 |
| Credentials / compliance | 🟢 | credentials 1/2 |
| Finance (AR/AP/expenses/petty cash) | 🟢 | accounts **23/17** — very mature |
| Accounts statements / ageing | 🟡 | page + API exist — verify/complete (B1) |
| Procurement (PR→LPO→GRN) | 🟡 | **Substantially built** — procurement 4/3 + 2 models; verify/complete (C) |
| Projects | 🟡 | **UI shells only** (3 pages, 0 API, 0 models) — add backend (D) |
| Legal | 🟡 | 2 UI pages, no API/model — unify + back with real data (B3) |
| Documents | 🟢 | 9 APIs (backend strong); dashboard surface thin |
| Assets | 🟢 | assets 1/2 |
| Fleet & logistics (vertical) | 🟢 | fleet **8/14** — deep; verify gaps only (E3) |
| HSE / safety | 🔴 | Mock (1 page, no model) — build (E5) |
| Facilities, board/governance | 🔴 | Not built (E1/E2) |
| Training & development | 🟢 | training 1/1 + 3 models |
| ESS portal | 🟢 | ess 3/**39** — mobile-first PWA, very mature |
| Outsourcing / BPO | 🟢 | outsourcing **12/27** — mature |
| Reports & analytics | 🟢 | reports 1/10 |
| Public marketing site (getstride.co.ke) | 🟢 | **Live + Stride-branded** (StudioCraftHomePage, /platform, /industries, marketing-config); audit honesty/brand (A9) |
| In-app brand (dashboard/ESS/demo) | 🟡 | Still **Imara** / `@imara.co.ke` — migrate to Stride (A8) |
| Design tokens | 🟡 | 3 unaligned systems (teal/blue) — unify on coral/orange (A7) |

**Verticals:** Logistics 🟢 live · SACCOs 🟡 (Imara demo pack) · Healthcare 🟡 · Energy 🟡 (HSE mock) · Construction 🔴.

---

## 4. Definition of "market-ready" (per module)

A module ships only when **all eight** hold:

1. **Functional** — real data, no mock/demo placeholders; CRUD + workflows complete.
2. **Integrated** — connects to adjacent modules (leave→payroll, attendance→payroll, payroll→invoice).
3. **ESS-visible** — employee/manager self-service where applicable.
4. **Permissioned** — RBAC keys defined, seeded, enforced on API + UI.
5. **Auditable** — sensitive actions logged.
6. **Deployable & tenant-safe** — `organizationId` on every table, RLS enforced, queries org-scoped; works on a fresh org via provisioning + seed; no manual DB hacks.
7. **Documented** — operator guide + `.env.example` keys.
8. **Tested** — Vitest and/or smoke script for critical paths.

---

## 5. The two finish lines

This plan drives toward **two concrete, dated targets**. Everything below serves them.

### Finish line 1 — Demo-ready on the marketing site
A prospect on **getstride.co.ke** can click into a **live, self-serve demo instance** that runs the
fictional Kenyan SME seed and shows a clean end-to-end path with **no mock pages on primary flows**:
login → dashboard → employees → run/show payslip → leave approval → invoice + M-Pesa match → ESS view.
Marketing copy is **honest**: every module/vertical badged `Live` · `Partial` · `Roadmap`.

**Gate:** Phase 0 (tenant-safe core) + Phase A complete (HR settled, mock performance gone,
M-Pesa demonstrable in sandbox) + copy audit.

### Finish line 2 — Launch (first paid clients live)
First subscription client signed up on a pooled cell **and** first enterprise client on a dedicated
instance — same codebase, `DEMO_MODE=false`, no reachable mock pages, RLS verified, backups tested,
support channel defined, sales battlecard + pricing live.

**Gate:** Phases 0 + A + B complete, quality bar in §6 Phase G met.

---

## 6. Phases (the build queue — follow in order)

Each phase is a **Linear Project** (team `RAV`). Each workstream is a **Linear issue**; Linear
auto-numbers them `RAV-NN` (the `0.1`/`A1` codes below are stable references in `LINEAR-IMPORT.md`).
**Phase 0 is the re-foundation and blocks everything** — it must complete before module phases run on
the new core. Phases A–B reach both finish lines; C–F expand to match the marketing promise; G is the
launch gate.

### Phase 0 — Multi-tenant core re-foundation  *(SEQUENTIAL · blocking · do first)*
*Goal: a tenant-safe foundation so every existing and future module is isolated by `organizationId`
with RLS, deployable as pooled regional cells or a dedicated instance from one codebase.*

| ID | Workstream | Key deliverables | Exit |
|----|------------|------------------|------|
| 0.1 | **Tenancy schema + RLS** | Add `Organization`; `organizationId` on every domain table; Postgres RLS policies + `app.current_org` per-request setting; migration plan for existing data → a default org | Data in Org A provably invisible to Org B (RLS test passes) |
| 0.2 | **Auth & session scoping** | Auth.js session carries `userId`, `currentOrgId`, `role`; `memberships` (user↔org); org switcher | A user in two orgs can switch; queries scope automatically |
| 0.3 | **Tenant context middleware** | One `withTenant()`/`can()` path that sets org context + RBAC on every request and mutation (`withAudit`) | No query trusts the app layer alone; audit records org |
| 0.4 | **Country config packs** | `statutory_config`/locale/currency/holidays keyed by country + effective date; KE pack first; UG/TZ stubs | Switching country = new config rows, no code change |
| 0.5 | **Cell + provisioning model** | Control-plane provisioning: create org on a cell (pooled) or stand up a dedicated instance; region routing (`KE`/`UG`/`TZ`); entitlement sync per `ENTITLEMENT-SYNC.md` | New org live on KE cell in minutes; dedicated path documented |
| 0.6 | **Module migration checklist** | Per-module gate: `organizationId` added, RLS on, scoped queries, tests; tracked as each A–G module moves onto the core | Every module that ships is tenant-safe by definition |

**Phase 0 exit criteria:** two orgs coexist on the KE cell with proven RLS isolation; one org can be
provisioned as a dedicated instance from the same schema; KE country pack drives statutory math;
control plane syncs entitlements to the cell. Tag `phase-0-complete`; treat `/core` as frozen.

### Phase A — Core HR settled  *(→ Demo-ready finish line · modules migrate onto Phase 0 core)*
*Goal: honestly claim "HR & Payroll" complete; demo has zero mock on HR paths.*

| ID | Workstream | Key deliverables | Exit |
|----|------------|------------------|------|
| A1 | **M-Pesa disbursement v1** | `PayrollDisbursementProvider` interface; bulk-transfer API (sandbox); payment status per employee | Disbursement demonstrable in sandbox |
| A2 | **Performance management (real)** | Prisma: `PerformanceCycle`, `Goal`, `Review`, `ReviewRating`, `Feedback`; cycle setup; manager + self review; ESS; **remove mock `/dashboard/performance`** | Run a full cycle for 50 seed employees |
| A3 | **Leave admin unify** | Single Leave hub (Employee | Staff tabs); fix `/outsourcing/leave` routing; policies/accrual; team calendar; liability report | No "Coming soon" in leave paths |
| A4 | **Payroll run wizard** | Select period → validate (missing PIN/NSSF/bank) → generate → review → approve → export/disburse; prior-month variance | Approved run with audit trail |
| A5 | **Marketing copy audit** | Badge every module/vertical `Live`/`Partial`/`Roadmap`; soften Procurement/Projects to "Roadmap" | getstride.co.ke is truthful |
| A6 | **Demo instance hardening** | `DEMO_MODE` demo on marketing site; seed Kenyan SME (~40 staff); verify end-to-end path has no dead ends | **Demo-ready finish line met** |

### Phase B — Finance & Legal credible  *(→ Launch finish line)*
| ID | Workstream | Key deliverables |
|----|------------|------------------|
| B1 | **Accounts statements** | Replace placeholder; debtor/creditor ageing; statement PDF email |
| B2 | **Billing automation** | Recurring invoices from headcount × rate card; payroll run → invoice draft (outsourcer markup) |
| B3 | **Legal surface unify** | One "Legal & compliance" nav: contracts + credentials + company docs |
| B4 | **Obligation register** | Renewal dates, owners, alerts (extends contracts/credentials) |
| B5 | **M-Pesa reconciliation** | Match disbursements + receipts to payroll/invoices |

### Phase C — Procurement (marketing module 03)
| ID | Workstream | Key deliverables |
|----|------------|------------------|
| C1 | Data model | `PurchaseRequest`, `PurchaseOrder` (LPO), `GoodsReceipt`, approval chain |
| C2 | Workflow | Request → approve → LPO PDF → vendor bill link |
| C3 | Spend dashboard | By department, vendor, budget line |
| C4 | Module licensing | `MODULE_PROCUREMENT`, nav, route guards, entitlement bucket |
| C5 | ESS (optional) | Staff submit PR from mobile |

### Phase D — Projects (marketing module 05)
| ID | Workstream | Key deliverables |
|----|------------|------------------|
| D1 | Data model | `Project`, `Milestone`, `ProjectTask`, time/cost allocation |
| D2 | Budget link | Tie to accounts budgets; actuals from payroll + AP + expenses |
| D3 | Dashboard | Project board, burn rate, deliverable status |
| D4 | Construction seed | Site/project template (moves vertical "coming soon" → available) |

### Phase E — Admin completion (marketing module 06)
| ID | Workstream | Key deliverables |
|----|------------|------------------|
| E1 | Facilities | Sites/locations, leases, maintenance tickets (light CMMS) |
| E2 | Board & governance | Resolution register, minutes, action tracking |
| E3 | Fleet polish | Fuel/maintenance logs, driver/partner registers |
| E4 | Fleet ESS | Driver trip updates + POD capture on mobile |
| E5 | HSE (real) | `HseIncident`/`HseAction`, investigation workflow; replace mock |

### Phase F — Industry vertical packs (parallel after A)
| ID | Vertical | Depends on | MVP scope |
|----|----------|-----------|-----------|
| F1 | SACCOs | A payroll | Member ledger, BOSA/FOSA, dividend run, SASRA templates |
| F2 | Healthcare | A time | Clinical rota rules, licence gate on shifts, NHIF hooks |
| F3 | Energy | E5 real HSE | Permit tracking, multi-entity HSE rollup |
| F4 | Construction | D projects | Site hierarchy, plant assets, subcontractor AP |

### Phase G — Launch hardening (gate before first paid client)
| ID | Workstream | Key deliverables |
|----|------------|------------------|
| G1 | Quality bar | No mock pages reachable with `DEMO_MODE=false`; lint/build clean |
| G2 | Sales enablement | `SALES-BATTLECARD.md` (vs SeamlessHR, spreadsheets, global HRIS); pricing page; 30-min demo script; security one-pager |
| G3 | Operator docs | HR admin guide, ESS user guide, implementation checklist |
| G4 | Reliability | Backup restore tested on Neon; support channel + SLA defined; fleet registry current |

---

## 7. Dependency graph

```
Phase 0 (multi-tenant core re-foundation) ──► BLOCKS EVERYTHING
   │
Phase A (core HR settled, on new core) ──► DEMO-READY finish line
   │
   ├──► Phase B (finance/legal) ──► LAUNCH finish line (with 0 + A)
   │
   ├──► Phase F vertical packs (parallel, after A)
   │
   └──► Phase C (procurement) ─► Phase D (projects) ─► Phase E (admin) ─► Phase G (launch hardening)
```
**Phase 0 is sequential and blocking** — no module phase runs until the tenant-safe core exists.
**Parallel-safe after A:** B ‖ F. C→D→E are sequential-ish (Projects budget needs Finance from B).
G is the final gate; do not provision a paid client before G.

---

## 8. Pricing ↔ module mapping (honest tiers)

Map commercial tiers to **licensed product modules** (`MODULE_*` + control-plane buckets), not
marketing labels, until Procurement and Projects exist.

| Tier | Topology | Module bundle | Buckets (see `ENTITLEMENT-SYNC.md`) |
|------|----------|---------------|-------------------------------------|
| Starter | Pooled cell | `core`, `leave`, `payroll`, `ess` | Foundational; max 2 horizontal; verticals blocked |
| Growth | Pooled cell | Starter + `time`, `accounts`, `ats`, `reports` | Foundational; max 4 horizontal |
| Enterprise | **Dedicated instance** (or pooled if they prefer) | All licensed modules + `fleet` + multi-entity | All buckets; verticals as add-on/ops pack |

Topology is a commercial lever: Starter/Growth live on the shared regional cell; Enterprise can buy a
**dedicated instance** (isolation, custom domain, white-label) on the same codebase. Until Phase C/D
ship, Enterprise = "full platform roadmap + priority vertical packs", **not** "all six marketing
modules feature-complete."

---

## 9. Cursor execution rules

- **Always pass context:** _"Follow `docs/STRIDE-MASTER-PLAN.md`. Work Linear issue RAV-NN. Architecture is pooled multi-tenant on Prisma — `organizationId` + RLS on every domain table; regional cells; dedicated for enterprise. Product name is Stride."_
- **Phase 0 first.** No module work until the tenant-safe core (`phase-0-complete`) exists. When migrating a module, run the §6 Phase 0.6 checklist: add `organizationId`, enable RLS, scope all queries, add tests.
- **Every new table is multi-tenant.** `organizationId` + RLS policy is a mandatory checklist item — a missed policy is a data leak.
- **One issue per session.** Don't let an agent wander across phases.
- **Respect `.cursor/rules/`** (`database-migrations.mdc`, `next-dev-build-safety.mdc`). Migrations additive-only; never destructive without sign-off.
- **Verify payroll math by hand** against a known-correct payslip before any demo.
- **Commit at each Definition of Done** with a tag; keep `FLEET-REGISTRY.md` in sync with releases.
- **No new mock pages.** If a screen can't be real yet, gate it behind a module flag, don't fake data.

---

## 10. Document map (what's canonical vs reference vs archived)

**Canonical (follow these):**
- `STRIDE-MASTER-PLAN.md` — this file. The plan.
- `LINEAR-IMPORT.md` — the same plan as importable Linear Projects/issues.
- `ENTITLEMENT-SYNC.md` — control-plane ↔ instance contract.
- `CLIENT-PROVISIONING.md` — provision a dedicated instance.
- `RELEASE-PROCESS.md`, `FLEET-REGISTRY.md` — ship + track the fleet.

**Reference (current, module-specific):**
- `PAYROLL-MONEY-MODEL.md`, `PAYROLL-BIWEEKLY*.md`, `STAFF-LEAVE.md`, `ESS-PLATFORM-SPEC.md`,
  `DEMO-CONTEXTS.md`, `DEMO-GUIDE-CARGO-LOGISTICS.md`, `MARKETING-DEPLOY.md`, `RESET-AND-GO-LIVE.md`.

**Archived (superseded — do not follow):** see `docs/archive/` and `ARCHIVE-LOG.md`
- `PRODUCT-MASTER-PLAN.md` (phases 0–9) → merged here.
- `module-roadmap.md` (phases A–F) → merged here.
- `BUILD-BLUEPRINT.md` → its multi-tenant/RLS instinct is now correct (see §2); we keep Prisma not Drizzle. Superseded by this file; kept for history.
- `B2B-SALES-REFERENCE.*` + `Backbone-HR-*.pdf` → old "Backbone HR" name; rebrand to Stride before reuse.

---

## 11. Maintenance

- When a workstream ships: tick it, update §3 snapshot, close the Linear issue.
- When a phase exits: update §5/§6 exit status; tag the release.
- Keep this the **only** plan. New module ideas become Linear issues under the right phase, not new docs.
