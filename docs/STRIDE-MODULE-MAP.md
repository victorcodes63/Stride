# Stride — Module & sub-module map

Canonical structure for the Stride platform: what customers buy, what appears in the module switcher, and what lives in the sidebar.

**Code reference:** `app/src/lib/stride-module-map.ts` (product modules) · `app/src/lib/modules.ts` (subscription keys) · `app/src/lib/dashboard-nav-catalog.ts` (sidebar items)

---

## Three layers

| Layer | What it is | Example | Controlled by |
|--------|------------|---------|----------------|
| **Product module** | Top-level area in the module switcher | HR & Payroll, Finance, **Projects** | Domain + minimum subscription key |
| **Subscription key** | Billable/licensable unit (`ModuleKey`) | `core`, `accounts`, **`projects`** | Control plane entitlements |
| **Sub-module** | Sidebar section + pages | Payroll runs, Invoices, Project board | Nav catalog + per-key entitlement |

**Rule:** HR is HR. Finance is Finance. **Projects is its own product module** with key `projects` — not bundled under `core`.

**Platform admin** is **role-gated** (admin / company-setup access), not an HR subscription.

---

## Product modules (switcher)

| # | Product module | Hub | Switcher requires | Subscription keys in this area |
|---|----------------|-----|-------------------|--------------------------------|
| 01 | **HR & Payroll** | `/dashboard/people` | `core` | core, leave, time, payroll, ats, performance, disciplinary, ess, training, reports |
| 02 | **Finance** | `/dashboard/accounts` | `accounts` | accounts |
| 03 | **Procurement** | `/dashboard/procurement` | `procurement` | procurement |
| 04 | **Legal & Documents** | `/dashboard/legal` | `legal` or `documents` | legal, documents |
| 05 | **Projects** | `/dashboard/projects` | **`projects`** | **projects** |
| 06 | **Fleet management** | `/dashboard/fleet` | `fleet` | fleet |
| 07 | **Operations** | `/dashboard/operations` | any of assets, hse, reports, communications | assets, hse, reports, communications |
| 08 | **Platform admin** | `/dashboard/platform` | admin role | *(none — not sold as a module)* |

Cross-module home: `/dashboard` (command center) — not a product module.

---

## Sub-modules by product area

### 01 — HR & Payroll

| Section | Key | Pages |
|---------|-----|--------|
| People | `core` | Employees, Departments, Tasks, Onboarding, Performance, Disciplinary |
| Recruitment | `ats` | Jobs, Applications, Assessments, Talent pool, Interviews |
| Time & Attendance | `time` / `leave` | Rota, Attendance, Leave, Biometric devices |
| Payroll | `payroll` | Runs, Payslips, Statutory, M-Pesa disbursements |
| Employee self-service | `ess` | Portal accounts, ESS & shifts, Document requests |
| Development | `training` | Training programs, Org chart |

### 02 — Finance

Clients, Invoices, Invoicing setup, Receipts, M-Pesa reconciliation, Payment accounts, Vendors, Vendor bills, Expense claims, Statements, Budgets, Petty cash, Financial reports.

### 03 — Procurement

Purchase requests, LPO register, Spend dashboard.

### 04 — Legal & Documents

Compliance hub, Contracts, Credentials, Company policies, Obligations register.

### 05 — Projects *(standalone)*

Overview, All projects, Project board, Tasks & deliverables, Budget vs actual.

### 06 — Fleet management

Orders & dispatch, Monitoring, Fleet assets, Commercial (four sidebar sections).

### 07 — Operations

Assets, HSE, Announcements, Reports, Analytics.

### 08 — Platform admin

Company setup, System users, Roles & permissions, Holidays, Facilities, Governance, Audit log, Settings.

---

## Vertical industry packs

Separate subscription keys, sidebar sections when enabled (not separate switcher domains today):

| Key | Label |
|-----|--------|
| `sacco` | SACCO |
| `healthcare` | Healthcare |
| `energy` | Energy |
| `construction` | Construction |

*Energy and Construction exist in the app; control-plane entitlement UI is catching up.*

---

## Entitlement buckets (commercial)

| Bucket | Keys |
|--------|------|
| **Foundational** | core, leave, time, payroll, accounts, ess, reports, disciplinary, documents |
| **Horizontal** | ats, performance, training, communications, procurement, legal, **projects** |
| **Vertical** | fleet, assets, hse, sacco, healthcare, energy, construction |

Enterprise = all keys. Growth = foundational + 4 horizontal + 1 vertical (defaults in `plan-standard-packages.ts`).

---

## Changelog

- **2026-06-30** — Projects promoted to subscription key `projects`; platform admin decoupled from HR `core` in domain map.
