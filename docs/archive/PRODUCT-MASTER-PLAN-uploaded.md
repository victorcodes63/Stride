# Product Master Plan — Market-Ready HRIS

**Purpose:** Single source of truth for building a polished, market-shareable HRIS — one module at a time — on a **dedicated deployment per company** model (not multi-tenant SaaS).

**Repo:** `hris-demo/`  
**Last updated:** May 2026  
**Related docs:** [`MODULE_AGENTS.md`](./MODULE_AGENTS.md) (parallel dev), [`RESET-AND-GO-LIVE.md`](./RESET-AND-GO-LIVE.md), [`STAFF-LEAVE.md`](./STAFF-LEAVE.md)

---

## 1. Product vision

### What we are building

An all-in-one HR platform for Kenyan and East African businesses — comparable in **module breadth** to enterprise players (e.g. SeamlessHR) — with a different **delivery and commercial model**:

| Principle | Decision |
|-----------|----------|
| **Deployment** | One company = one instance (own DB, domain, env, release boundary) |
| **Audience** | Mid-market employers + HR outsourcers / payroll bureaus |
| **Edge** | Built by HR practitioners for HR operations — workflows, compliance, and billing that match how HR is actually run |
| **Pricing** | Transparent modular pricing; undercut enterprise “request demo” friction |
| **Scope** | Full employee lifecycle: hire → onboard → time → pay → perform → develop → exit → bill (for outsourcers) |

### What we are *not* building (v1)

- Multi-tenant platform (shared DB, `tenant_id` on every row, subdomain routing)
- Pan-African statutory engines for every country on day one (Kenya first; others as packs)
- Payroll financing / earned wage access without a banking partner (phase later)
- Native iOS/Android apps (PWA-first ESS; native optional later)

### Definition of “market-ready”

A module is **market-ready** when:

1. **Functional** — real data (no mock/demo placeholders), CRUD + workflows complete
2. **Integrated** — connects to adjacent modules (e.g. leave → payroll, attendance → payroll)
3. **ESS-visible** — employee/manager self-service where applicable
4. **Permissioned** — RBAC keys defined, seeded, enforced on APIs and UI
5. **Auditable** — sensitive actions logged where required
6. **Deployable** — works on a fresh client instance via env + seed (no manual DB hacks)
7. **Documented** — operator guide + `.env.example` keys for that module
8. **Tested** — Vitest and/or smoke script for critical paths

---

## 2. Architecture: dedicated deployment model

```
┌─────────────────────────────────────────────────────────────┐
│  One codebase (hris-demo)                                   │
│  Releases tagged → deployed to N client instances           │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Client A │  │ Client B │  │ Client C │
   │ Vercel   │  │ Vercel   │  │ VPS/Cloud│
   │ Neon DB  │  │ Neon DB  │  │ Own DB   │
   │ hr.a.com │  │ hr.b.co.ke│ │ hr.c.com │
   └──────────┘  └──────────┘  └──────────┘
```

**Per-deployment configuration (env-driven):**

- Branding: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_ORG_NAME`, `NEXT_PUBLIC_BRAND_LOGO`, …
- Country / entity: `DEFAULT_COUNTRY=KE`, entity switcher for multi-legal-entity within one company
- Modules: `MODULE_*` flags (see §12)
- Integrations: SMTP, Microsoft/Google OAuth, biometric devices, payment provider keys

**Do not introduce platform multi-tenancy.** If a staffing firm needs many end-clients under one company, use **Accounts billing clients** + workforce tagging — not separate tenants on shared infra.

---

## 3. Current state snapshot

Use this as the baseline when picking up a workstream.

| Module | Status | Notes |
|--------|--------|-------|
| **Platform & branding** | 🟢 Strong | Env-based brand; production vs demo mode; neutral defaults |
| **Client provisioning** | 🟢 Strong | Runbook, provision-check, seed:production, smoke:platform |
| **Module licensing** | 🟢 Strong | MODULE_* flags, middleware, nav filtering |
| **Fleet updates** | 🟡 Partial | Registry doc + release process; manual deploy per client |
| **Auth & security** | 🟢 Strong | Staff + ESS sessions, MFA, RBAC, audit log |
| **Core HR / employees** | 🟢 Strong | Master data, import, documents, lifecycle, KE/UG entities |
| **Departments & org** | 🟢 Strong | Per workspace |
| **Onboarding / offboarding** | 🟢 Strong | Templates, tasks, overdue cron |
| **Disciplinary & grievance** | 🟢 Strong | Staff + ESS, EAC jurisdictions |
| **Credentials / compliance** | 🟢 Strong | Expiry tracking, reminder cron |
| **Staff leave (internal)** | 🟢 Strong | Types, balances, approvals |
| **Employee leave** | 🟡 Partial | ESS + schema work; staff UI “Coming soon”, routing quirk |
| **Rota & scheduling** | 🟢 Strong | Templates, periods, CSV import |
| **Attendance v2** | 🟢 Strong | Policies, summaries, exceptions; feature flag |
| **Biometrics** | 🟢 Strong | Hikvision adapter, import, poll cron |
| **Payroll (Kenya)** | 🟢 Strong | Monthly/bi-weekly, statutory, payslips, bank export |
| **Statutory returns** | 🟢 Strong | Filing workflow, exports (P9, P10, NSSF, SHIF) |
| **Recruitment / ATS** | 🟢 Strong | Jobs, pipeline, interviews, scorecards, hire conversion |
| **Performance management** | 🔴 Mock | Demo KPI page only; no DB model |
| **HSE / safety** | 🔴 Mock | UI prototype, no persistence |
| **Accounts / finance** | 🟢 Strong | Invoices, AP, contracts; statements placeholder |
| **ESS portal** | 🟢 Strong | Mobile-first PWA; leave, payslips, attendance, cases |
| **Reports & analytics** | 🟢 Strong | Headcount, payroll cost, statutory CSV, executive view |
| **Employee benefits / EWA** | 🔴 Missing | — |
| **Payroll disbursement** | 🔴 Missing | Bank export only |
| **Geo mobile clock-in** | 🔴 Missing | — |
| **Candidate assessments** | 🔴 Missing | Scorecards only |
| **ERP integrations** | 🔴 Missing | OAuth for login only |
| **Public marketing site** | 🔴 Trimmed | `/` → careers; no product marketing |

Legend: 🟢 Market-ready or close · 🟡 Partial · 🔴 Not built / mock

---

## 4. Build phases overview

Execute **in order** within each phase; phases can overlap only where dependencies allow.

| Phase | Name | Outcome |
|-------|------|---------|
| **0** | Platform foundation | Any client can get a clean dedicated instance |
| **1** | Core HR polish | Employee lifecycle production-grade |
| **2** | Time & leave | Unified leave; attendance → payroll closed loop |
| **3** | Payroll excellence | Kenya statutory gold standard + disbursement path |
| **4** | Talent acquisition | ATS market-ready + assessments |
| **5** | Performance & development | Real PM replacing mock dashboard |
| **6** | Compliance & safety | HSE, credentials polish, audit pack |
| **7** | Finance & outsourcer | Accounts completion for BPO model |
| **8** | Enterprise extensions | Benefits, ERP, extra countries (optional modules) |
| **9** | Go-to-market | Marketing site, sales collateral, fleet ops |

**Estimated calendar (solo + agents):** Phase 0–2 ≈ 6–8 weeks · Phase 3–5 ≈ 10–14 weeks · Phase 6–9 ≈ 8–12 weeks. Adjust for team size.

---

## 5. Phase 0 — Platform foundation

*Goal: Provision Client X in under half a day with no Stabex/demo leakage.*

### 0.1 — Client provisioning runbook

**Deliverables**

- [x] `docs/CLIENT-PROVISIONING.md` — step-by-step: Neon DB, Vercel project, Blob, env template, domain, migrate, seed, smoke test
- [x] `scripts/provision-check.mjs` — validates required env vars (`npm run provision:check`)
- [x] `scripts/smoke-platform.mjs` — login, deployment config, employees, module-aware checks (`npm run smoke:platform`)

**Acceptance**

- Fresh deploy from empty DB → working admin login → one employee → one payslip path in < 30 min following the doc

### 0.2 — Remove demo defaults from runtime

**Deliverables**

- [x] `getOrCreatePrimaryWorkspaceClient()` uses `PROVISION_ORG_NAME` / `NEXT_PUBLIC_ORG_NAME` (via `getWorkspaceDefaults()`)
- [x] Seed script split: `seed:demo` (sales demo) vs `seed:production` (minimal go-live)
- [x] Login pages: demo credential hints only when `DEMO_MODE=true` + `NEXT_PUBLIC_DEMO_MODE=true`

**Key files:** `src/lib/primary-workspace-client.ts`, `prisma/seed-production.ts`, `src/components/DemoLoginCredentialsHint.tsx`

### 0.3 — Module licensing flags

**Deliverables**

- [x] `src/lib/modules.ts` — central registry: `MODULE_PAYROLL`, `MODULE_ATS`, `MODULE_PERFORMANCE`, …
- [x] `DashboardNav.tsx` + ESS nav hide disabled modules
- [x] Middleware + API return 403 with clear message if module disabled
- [x] Document all flags in `.env.example`

**Acceptance**

- Setting `MODULE_ATS=false` removes Jobs/Applications from nav and blocks `/api/jobs`

### 0.4 — Fleet visibility (internal)

**Deliverables**

- [x] `docs/FLEET-REGISTRY.md` template — spreadsheet: client name, URL, DB host, version/git tag, modules enabled, last deploy
- [ ] (Optional later) simple internal `/admin/fleet` page behind super-admin env key

### 0.5 — Release & migration discipline

**Deliverables**

- [x] `docs/RELEASE-PROCESS.md` — tag → staging → per-client `migrate deploy` → smoke → promote
- [x] CI: build + test on PR; deploy workflow documented
- [x] Rule: migrations additive-only; never destructive without client sign-off

**Phase 0 exit criteria:** Two separate deployments (e.g. “Acme” and “Beta Corp”) on different DBs, different branding, same codebase tag.

---

## 6. Phase 1 — Core HR polish

*Goal: Employee record is the trusted system of record for everything downstream.*

### 1.1 — Employee master data hardening

**Deliverables**

- [ ] Bulk import validation report (row-level errors downloadable)
- [ ] Sensitive fields (salary, bank, ID) gated by RBAC + access log (extend `sensitive-fields` if needed)
- [ ] Employee timeline: unified view (lifecycle, transfers, documents, credentials, cases)
- [ ] Export: employee register CSV/Excel for auditors

**Acceptance**

- HR can import 200 employees, fix errors, and produce auditor export without developer help

### 1.2 — Org structure

**Deliverables**

- [ ] Department hierarchy (parent department) if not present
- [ ] Manager assignment drives ESS approval chains and reports
- [ ] Org chart view (read-only) on dashboard

### 1.3 — Contracts (HR view)

**Deliverables**

- [ ] Contract renewal dashboard: expiring in 30/60/90 days
- [ ] Link contract terms to payroll (salary revision triggers)
- [ ] ESS: view own contract summary (optional)

**Key files:** `src/app/dashboard/(app)/people/contracts/`, Accounts contract models

### 1.4 — Onboarding / offboarding polish

**Deliverables**

- [ ] Template library per role/department
- [ ] Auto-assign tasks on hire conversion from ATS
- [ ] Offboarding checklist: access revoke reminders, final pay flag, exit interview note
- [ ] Email notifications for assignees (not just in-app)

**Phase 1 exit criteria:** Hire-from-ATS → onboarding tasks → active employee with documents and manager chain — demoable in 15 minutes.

---

## 7. Phase 2 — Time & leave

*Goal: Leave and attendance feed payroll correctly; no “Coming soon” in core paths.*

### 2.1 — Unify employee leave (staff dashboard)

**Current gap:** ESS works; staff UI at `/dashboard/outsourcing/leave` is “Coming soon”; `/dashboard/leave` points to staff leave only.

**Deliverables**

- [ ] Single **Leave** hub with tabs: Employee leave | Staff leave (or role-based default)
- [ ] Fix routing: remove redirect that hides employee leave admin
- [ ] Admin: leave types, policies, balances, accrual rules (`FEATURE_LEAVE_POLICY_V2` on by default for new deploys)
- [ ] Calendar view: team availability
- [ ] Reports: leave liability, balances by department

**Key files:** `src/app/dashboard/(app)/leave/`, `src/app/dashboard/(app)/outsourcing/leave/page.tsx`, `prisma` leave models, `/api/leave/*`, `/api/staff/leave/*`

**Acceptance**

- Manager approves in ESS → balance updates → payroll run respects leave pay mode (none / PAYE-only / in gross)

### 2.2 — Attendance → payroll integration

**Deliverables**

- [ ] Document and enforce: overtime from shift engine flows into payroll generation
- [ ] UI indicator on payroll run: “3 employees with unresolved attendance exceptions”
- [ ] Biometric poll cron registered in `vercel.json` (currently implemented but not scheduled)

**Key files:** `src/lib/payroll-calc.ts`, `src/lib/shift-engine/`, `vercel.json`, `docs/PAYROLL-BIWEEKLY-ATTENDANCE.md`

### 2.3 — Geo mobile clock-in (ESS)

**Deliverables**

- [ ] ESS: clock in/out with GPS capture (browser geolocation)
- [ ] Admin: define geofence per site (lat, lng, radius metres)
- [ ] Attendance events: `source: mobile_geo` vs `biometric` vs `manual`
- [ ] Policy: reject clock-in outside fence (with override workflow for managers)

**Acceptance**

- Field employee clocks in on phone; attendance summary shows location compliance; optional payroll link for hourly staff

### 2.4 — Rota polish

**Deliverables**

- [ ] ESS: view my upcoming shifts
- [ ] Swap/request coverage workflow (manager approve)
- [ ] Print/export weekly rota per site

**Phase 2 exit criteria:** Leave + attendance + rota + biometrics → payroll run with exceptions visible and explainable.

---

## 8. Phase 3 — Payroll excellence (Kenya)

*Goal: Best-in-class Kenya payroll on a dedicated instance — better local depth than generic pan-African platforms.*

### 3.1 — Statutory accuracy & filing

**Deliverables**

- [ ] Statutory rate tables versioned by effective date (NSSF tier changes, SHIF, AHL)
- [ ] Pre-run validation: missing KRA PIN, NSSF number, bank details
- [ ] Monthly returns: one-click export pack for client accountant
- [ ] Payslip compliance: all required fields per Kenya practice

**Key files:** `src/lib/payroll-calc.ts`, statutory routes, `docs/PAYROLL-MONEY-MODEL.md`

### 3.2 — Payroll operations UX

**Deliverables**

- [ ] Run wizard: select period → validate → generate → review → approve → export/pay
- [ ] Comparison vs prior month (variance report)
- [ ] Reversal / supplementary run support
- [ ] Approval chain for payroll finalize (Finance/Director)

### 3.3 — Disbursement integration (v1)

**Deliverables**

- [ ] Abstract `PayrollDisbursementProvider` interface
- [ ] v1: enhanced bank file formats (major Kenyan banks)
- [ ] v1.5: API integration (e.g. Flutterwave/Paystack bulk transfer) — keys per deployment
- [ ] Payment status tracking per employee on payroll run

**Note:** Full “payroll financing” (SeamlessHR-style) requires a lending partner — defer to Phase 8.

### 3.4 — Multi-entity payroll (KE + UG)

**Deliverables**

- [ ] Entity switcher scopes payroll runs and statutory exports correctly
- [ ] Uganda statutory pack stub OR explicit “UG payroll not enabled” gate until built
- [ ] Cross-entity employee transfer payroll handoff documented

**Phase 3 exit criteria:** Client accountant accepts statutory exports; payroll run approved with audit trail; bank file or API disbursement tested.

---

## 9. Phase 4 — Talent acquisition (ATS)

*Goal: Recruit → hire → onboard without leaving the system.*

### 4.1 — ATS polish

**Deliverables**

- [ ] Careers page: client branding, SEO meta, configurable filters
- [ ] Application UX: mobile-friendly, save progress, clear status for candidates
- [ ] Pipeline analytics: time-to-hire, source, stage conversion
- [ ] GDPR-style consent + data retention settings for applications

### 4.2 — Collaboration & governance

**Deliverables**

- [ ] Requisition + offer approval chains polished (already in schema)
- [ ] Interview scheduling: conflict detection, candidate self-service (confirm/reschedule/withdraw) — verify production-ready
- [ ] Internal notes vs candidate-visible communications separation

### 4.3 — Candidate assessments

**Deliverables**

- [ ] Assessment library: MCQ, numeric, file upload
- [ ] Assign assessment to job stage; auto-score where possible
- [ ] Anti-cheating basics: time limit, one attempt, IP log
- [ ] Results on candidate profile + export

**Acceptance**

- Job posts with stage “Technical test” → candidate completes → recruiter sees score before interview

### 4.4 — Hire conversion

**Deliverables**

- [ ] Hire wizard: maps application fields → employee record → onboarding template
- [ ] Duplicate detection (email, phone, national ID)
- [ ] Audit: who hired whom, when

**Phase 4 exit criteria:** End-to-end public apply → interview → offer → employee → onboarding tasks without manual re-entry.

---

## 10. Phase 5 — Performance & development

*Goal: Replace mock performance dashboard with real review cycles.*

### 5.1 — Data model

**Deliverables**

- [ ] Prisma models: `PerformanceCycle`, `Goal`/`Objective`, `Review`, `ReviewRating`, `Feedback`, optional `Competency`
- [ ] Support cycle types: annual, quarterly, probation
- [ ] Framework config: OKR lite and/or balanced scorecard categories (env or admin setting)

### 5.2 — Admin & manager UX

**Deliverables**

- [ ] Cycle setup: dates, participants, template questions
- [ ] Manager: rate direct reports, write comments, calibrate view (HR)
- [ ] Employee self-assessment step before manager review
- [ ] Remove or gate mock `/dashboard/performance` demo data

**Key files:** Replace `src/app/dashboard/(app)/performance/page.tsx` (DEMO_EMPLOYEES), implement `people/performance`

### 5.3 — ESS performance

**Deliverables**

- [ ] ESS: my goals, self-assessment, view finalized review
- [ ] Notifications: cycle opened, review due, review published

### 5.4 — Reporting

**Deliverables**

- [ ] Distribution of ratings by department
- [ ] Probation outcome report
- [ ] Export for EXCO (PDF/Excel)

**Phase 5 exit criteria:** Run a full Q1 cycle for 50 employees; managers and employees complete in ESS; HR exports summary.

---

## 11. Phase 6 — Compliance & safety

### 6.1 — HSE module (real)

**Deliverables**

- [ ] Prisma: `HseIncident`, `HseAction`, attachments, severity, status
- [ ] Replace mock `/dashboard/hse` with CRUD + investigation workflow
- [ ] Link incidents to employee, site, credentials where relevant
- [ ] Reports: incidents by site, LTIFR-style counts (configurable)

### 6.2 — Credentials polish

**Deliverables**

- [ ] ESS: view my credentials and expiry
- [ ] Block assignment to rota/shift if required credential expired (configurable)
- [ ] Bulk upload credentials CSV

### 6.3 — Disciplinary & grievance polish

**Deliverables**

- [ ] Letter templates per jurisdiction (PDF generation)
- [ ] Statutory timeline reminders (response due dates)
- [ ] Analytics: cases by type, outcome, department

### 6.4 — Audit & compliance pack

**Deliverables**

- [ ] `docs/COMPLIANCE-PACK.md` — data retention, RBAC matrix, audit log export, backup expectations
- [ ] One-click audit log export (date range, CSV)
- [ ] Data Processing Agreement template for clients

**Phase 6 exit criteria:** HSE incident logged → investigated → closed; credential expiry blocks noncompliant shift (if enabled).

---

## 12. Phase 7 — Finance & HR outsourcer mode

*Goal: Win BPO/PEO clients SeamlessHR does not optimize for.*

### 7.1 — Accounts statements

**Deliverables**

- [ ] Replace placeholder at `/dashboard/accounts/statements`
- [ ] Client statement: invoices, receipts, ageing
- [ ] Send statement email PDF

### 7.2 — Billing automation

**Deliverables**

- [ ] Recurring invoice generation from headcount × rate card
- [ ] Link payroll run → invoice draft (pass-through wages + markup)
- [ ] Credit note workflow polish

### 7.3 — Client reporting (outsourcer)

**Deliverables**

- [ ] Per–billing-client workforce report: headcount, turnover, payroll cost
- [ ] White-label option: client-facing PDF reports with their logo (env)

**Phase 7 exit criteria:** Monthly bill generated from workforce + payroll markup; statement sent to client contact.

---

## 13. Phase 8 — Enterprise extensions (optional modules)

Build only when a paying client or partner requires them. Each is a **separate module flag**.

| Module | Deliverables (summary) | Dependency |
|--------|------------------------|------------|
| **Employee benefits** | Benefits catalog, enrolment, dependants; optional insurer API | Core HR |
| **EWA / salary advance** | Partner integration; policy rules; payroll deduction | Payroll 3.3 |
| **ERP export** | Sage, QuickBooks, Xero — chart of accounts mapping | Accounts |
| **SAP/Oracle** | Enterprise connector (SOW per client) | ERP export |
| **Uganda payroll** | URA/PAYE/NSSF equivalent engine | Payroll 3.x |
| **Nigeria payroll** | PAYE, pension, NHF — separate statutory pack | Payroll 3.x |
| **Native mobile app** | React Native ESS shell or Capacitor wrapper | ESS stable |
| **AI assist** | Anomaly detection on attendance/payroll; draft job descriptions | Data volume |

---

## 14. Phase 9 — Go-to-market

### 9.1 — Public marketing site

**Deliverables**

- [ ] Product landing: modules, dedicated deployment story, pricing tiers
- [ ] `/` = marketing home; `/careers` remains for client’s own jobs OR separate careers subdomain pattern documented
- [ ] Case study template (even 1 pilot client)
- [ ] Request demo / contact form → CRM or email

### 9.2 — Sales enablement

**Deliverables**

- [ ] `docs/SALES-BATTLECARD.md` — vs SeamlessHR, vs spreadsheets, vs global HRIS
- [ ] Module matrix + indicative pricing page
- [ ] Demo script: 30-minute walkthrough (hire → pay → invoice)
- [ ] Security one-pager (MFA, encryption, dedicated instance, backups)

### 9.3 — Operator documentation

**Deliverables**

- [ ] HR Admin guide (PDF or docs site): leave, payroll, recruitment
- [ ] ESS user guide (short, mobile screenshots)
- [ ] Implementation checklist for new clients (parallel to Phase 0)

### 9.4 — Quality bar before first paid client

- [ ] No mock data pages reachable in production (`DEMO_MODE=false`)
- [ ] Lint/build clean or explicitly waived with ticket
- [ ] Backup restore tested on Neon
- [ ] Support channel defined (email, SLA tiers)

**Phase 9 exit criteria:** Marketing site live; sales can run demo on dedicated staging instance; first pilot client provisioned via runbook.

---

## 15. Module licensing matrix

Suggested commercial packages (configure via env per deployment):

| Module flag | Includes | Typical buyer |
|-------------|----------|---------------|
| `MODULE_CORE` | Employees, departments, documents, org | All |
| `MODULE_LEAVE` | Leave policies, approvals, calendar | All |
| `MODULE_TIME` | Rota, attendance, biometrics, geo | Ops-heavy |
| `MODULE_PAYROLL` | Kenya payroll, statutory, payslips | All |
| `MODULE_ATS` | Careers, pipeline, interviews | Growing cos |
| `MODULE_PERFORMANCE` | Cycles, goals, reviews | 50+ employees |
| `MODULE_HSE` | Incidents, actions | Manufacturing, O&G |
| `MODULE_ACCOUNTS` | Invoicing, AP, statements | Outsourcers |
| `MODULE_DISCIPLINARY` | Cases, grievances | All (often bundled) |

**Bundle examples**

- **Essentials:** CORE + LEAVE + PAYROLL  
- **Workforce:** Essentials + TIME  
- **Talent:** Essentials + ATS  
- **Outsourcer:** Essentials + TIME + ATS + ACCOUNTS  
- **Full:** All modules enabled  

---

## 16. Execution order (dependency graph)

```
Phase 0 (foundation)
    ↓
Phase 1 (core HR) ─────────────────────────────┐
    ↓                                          │
Phase 2 (time & leave)                         │
    ↓                                          │
Phase 3 (payroll) ←────────────────────────────┤
    ↓                                          │
Phase 4 (ATS) ─── hire → onboarding (Phase 1)  │
    ↓                                          │
Phase 5 (performance)                          │
    ↓                                          │
Phase 6 (compliance)                           │
    ↓                                          │
Phase 7 (accounts) ← outsourcer clients ───────┘
    ↓
Phase 8 (optional extensions, parallel)
    ↓
Phase 9 (GTM)
```

**Parallel safe pairs (after Phase 0):**

- Phase 4 (ATS) + Phase 2.3 (geo clock-in) — different teams
- Phase 6 (HSE) + Phase 5 (performance) — after Phase 1
- Phase 9.1 (marketing site) — can start copy/design during Phase 3–5

---

## 17. Per-module work packet template

When starting any section above, copy this into a GitHub issue or agent prompt:

```markdown
## Module: [e.g. 2.1 Unify employee leave]

### Goal
[One sentence]

### Acceptance criteria
- [ ] ...
- [ ] ...

### Key paths
- `src/...`
- `prisma/...`

### Dependencies
- Requires: Phase X complete
- Blocks: Phase Y

### Out of scope
- ...

### Test plan
1. ...
2. ...

### Docs to update
- [ ] `.env.example`
- [ ] Operator guide section
```

---

## 18. Competitive parity checklist (SeamlessHR)

Use before claiming “full platform” in marketing:

| Capability | Target phase | Done |
|------------|--------------|------|
| Core HRMS | Phase 1 | ☐ |
| Leave management | Phase 2 | ☐ |
| Time & attendance | Phase 2 | ☐ |
| Biometric integration | Done | ☑ |
| Geo-fencing | Phase 2.3 | ☐ |
| Payroll + statutory (KE) | Phase 3 | ☑ partial |
| Payroll disbursement | Phase 3.3 | ☐ |
| Payroll financing | Phase 8 | ☐ |
| Recruitment / ATS | Phase 4 | ☑ partial |
| Candidate assessments | Phase 4.3 | ☐ |
| Performance / OKR | Phase 5 | ☐ |
| Employee benefits | Phase 8 | ☐ |
| Onboarding | Phase 1.4 | ☑ partial |
| Reporting & analytics | Done | ☑ partial |
| ERP integrations | Phase 8 | ☐ |
| Multi-country statutory | Phase 8 | ☐ |
| ISO / enterprise security narrative | Phase 6.4 + 9 | ☐ partial |
| Dedicated deployment story | Phase 0 | ☐ partial |

---

## 19. Success metrics (first 12 months)

| Metric | Target |
|--------|--------|
| Pilot clients on dedicated instances | 3–5 |
| Provisioning time | < 4 hours |
| Payroll run without support | Client HR self-serve |
| Module uptime | 99.5% per instance |
| Time-to-hire (ATS) | Measurable in product analytics |
| Referenceable case study | ≥ 1 |

---

## 20. Document maintenance

- Update **§3 Current state snapshot** when a phase exits
- Add new `docs/*.md` per major module (link from here)
- Keep `MODULE_AGENTS.md` for parallel Cursor agents; this doc is the **sequential product roadmap**
- Version releases in git tags matching `FLEET-REGISTRY.md`

---

## Quick start: what to build next

If starting today, do these in order:

1. **0.1 + 0.2 + 0.3** — provisioning runbook, remove demo defaults, module flags  
2. **2.1** — unify employee leave (biggest internal inconsistency)  
3. **5.1–5.2** — real performance (biggest competitive gap vs mock)  
4. **3.3** — disbursement path (competitive with SeamlessHR payroll story)  
5. **9.1** — marketing site (only after 0–3 are demo-clean with `DEMO_MODE=false`)

---

*This is a living document. Treat each checkbox as a shippable unit of work toward a polished, market-ready product.*
