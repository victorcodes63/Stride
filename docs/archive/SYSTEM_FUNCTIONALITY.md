# HRIS Demo — System functionality overview

This document describes **what the application does today**, based on the codebase (dashboard routes, public pages, APIs, and Prisma models). Items marked **placeholder** or **coming soon** are present in the UI or schema but are not fully implemented end-to-end.

---

## Platform summary


| Area                | Role                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Public site**     | Marketing, services, careers board, resources, contact                                                               |
| **Staff dashboard** | Recruitment ATS, interviews, outsourcing HR/payroll, internal staff leave, accounts/billing, users, insights CMS     |
| **Candidate flows** | Apply for jobs (multi-stage application), interview confirm / reschedule / withdraw via token links                  |
| **Data & stack**    | Next.js App Router, PostgreSQL (Prisma), optional Vercel Blob for uploads, email for applications/contact/interviews |


---

## 1. Public website (marketing)

- **Home, About, Services** — Brand pages, animations (Framer Motion), responsive layout.
- **Contact** — Contact form backed by API (`/api/contact`) with validation; aligns with email setup docs.
- **Careers** — Lists active job openings; links to application flows.
- **Insights** — Public listing (`/insights`) and article-style pages (`/insights/[slug]`) fed from the `Insight` model / API.
- **Resources** — HR tools and guides (e.g. interview checklists, PAYE/gross/net calculators).
- **Legal** — Privacy and terms pages.
- **SEO & performance** — Metadata, structured layout; standard Next.js optimizations.

---

## 2. Candidate experience (job board & applications)

- **Job records** — Rich job model: title, location, type, category, description, requirements/responsibilities/benefits (JSON), skills, salary (optional public display), experience/education filters, client linkage, confidential posting, application window (start/deadline), reference IDs and slugs.
- **Apply** — `/careers/apply/[id]` application flow with CV/certificate uploads (Blob in production, local `public/uploads` in dev when Blob is not configured).
- **Applications** — `Application` + `Candidate` models; statuses: pending, reviewed, shortlisted, rejected, hired; internal notes; structured `formData` for extended questionnaire stages.
- **Application views** — Staff “who has opened this application” tracking (`ApplicationView`).
- **Exports & bulk actions** (staff) — Application export API, bulk CV download, bulk rejection sending (API routes under `/api/applications/...`).

---

## 3. Authentication & users

- **Staff dashboard auth** — Login, logout, session/me endpoint; Microsoft OAuth start/callback routes; forgot-password flow (see `AUTH.md`).
- **Roles** — `UserRole`: admin, staff, viewer.
- **Staff personas** — `StaffUserType` (operations, business_manager, finance, director) for permission-sensitive features (e.g. executive analytics, leave approvers).
- **Staff user management** — `/dashboard/users/staff` for creating/managing internal accounts and Accounts module permissions (`AccountsStaffAccess`: contracts, invoices, payments, vendors scoped per client or global).
- **Recruitment client portal users** — Separate `RecruitmentClientPortalUser` records (email/password) tied to a recruitment `Client`; admin UI at `/dashboard/users/recruitment-clients` and CRUD APIs. **Dedicated employer sign-in UX can be wired later** (data model and admin tools exist).

---

## 4. Recruitment (ATS) — staff dashboard

- **Clients** — Recruitment employer clients (`Client`): contact details, anonymous/confidential display options; link to optional `AccountsClient` and portal users.
- **Job openings** — Create/edit jobs, tie to clients, activate/deactivate, categories, structured filters for candidate matching.
- **Applications pipeline** — List/filter applications, view detail, update status, notes, stage data.
- **Candidates** — Candidate database with resume paths, demographics/filters, stats API; bulk resume download.
- **Search** — Global search API for dashboard use (`/api/search`).
- **Dashboard home** — Role-aware overview and shortcuts (including Accounts and recruitment highlights where applicable).

---

## 5. Interviews

- **Scheduling** — Interviews linked to applications; datetime, duration (30/45/60), type (phone/video/onsite), location/link, notes, status (scheduled/completed/cancelled).
- **Candidate comms** — Send invite API; export schedule; bulk operations (update/delete).
- **Microsoft Teams** — API to create Teams meetings for an interview.
- **Schedule breaks** — Per-job calendar breaks (lunch/buffers) with APIs and inclusion in exports.
- **Shortlist helper** — API to list jobs with shortlisted candidates for scheduling workflows.
- **Candidate token pages** — Confirm, reschedule, withdraw interview without logging into the dashboard (`/interview/confirm|reschedule|withdraw/[token]`).
- **Official letter / PDF** — Optional storage path for government-style invite attachments.

---

## 6. Executive analytics

- **Analytics dashboard** (`/dashboard/analytics`) — Restricted to admin or Director-type staff; charts and metrics over jobs, applications (by status/month), interviews, and drill-down behaviour (client-side data loading from existing APIs).

---

## 7. People & HR (internal staff)

- **Staff leave** — Leave types (API + admin), balances, applications, approval workflow APIs (`/api/staff/leave/...`); dashboard page `/dashboard/staff-leave`.
- **Assigned tasks** — **Placeholder** page only (no task model wired yet).
- **Performance** — **Placeholder** page only.
- **Contracts (HR view)** — Navigation and copy describe contract monitoring; **detail page is stub** (“wire-up next”). Financial/contracts of record live under **Accounts** (see below) with reminders; this area is the cross-link / future HR-facing contract hub.

---

## 8. Outsourcing module (client HR operations)

- **Clients** — `OutsourcingClient` with Kenya tax IDs, banking, billing metadata, contract dates, payroll frequency, leave pay modes.
- **Departments** — Nested under outsourcing clients; employee assignments.
- **Employees** — Full employee records (contact, IDs, KRA/NSSF/NHIF, bank, base salary, auto employee numbers); edit flows; bulk delete; import from template/API; bulk assign department.
- **Payroll (Kenyan statutory)** — Monthly or bi-weekly flows; PAYE, NSSF, SHIF (NHIF field), Affordable Housing Levy; allowances/deductions JSON; **draft / approved / paid** statuses; generate/recalculate statutory; payslip PDFs; email payslips API; payroll list UIs under **Outsourcing → Payroll** and payslip subpages.
- **Payroll input import template** — Payroll page now supports download/upload of a payroll-input sheet (National ID match, days worked/incentives/allowances/overtime/holiday/leave/gross inputs), preview classification (matched/unmatched/invalid), optional create-missing-employee prompt, then commit to create/update **draft** payroll records.
- **Leave (outsourced employees)** — **Data model exists** (`LeaveType`, `LeaveBalance`, `LeaveApplication`) **but dashboard UI is “coming soon”** at `/dashboard/outsourcing/leave`.
- **Attendance** — **Data model exists** (`Attendance`) **but dashboard UI is “coming soon”** at `/dashboard/outsourcing/attendance`.

---

## 9. Accounts & finance (dashboard)

Scoped by `AccountsStaffAccess` and `StaffUserType` where relevant.

### 9.1 Accounts clients & contracts

- **Billing profiles** — `AccountsClient` types: outsourcing, recruitment, custom; links to outsourcing or recruitment entities; currency; **internal billing notes**; sequential **invoice** and **credit note** counters.
- **Contracts** — Engagement contracts with title/reference, start/end dates, assigned **contract managers** (staff users), optional **reminder disable** flag.
- **Contract reminders** — Cron job sends milestone reminders (2 months, 1 month, 14 days, 7 days, expiry day, weekly post-expiry); tracked in `ContractReminderSent`; surfaces **in-app notifications** (`StaffNotification`).
- **Client UI** — List/create/detail accounts clients; counts for invoices, contracts, payments, payrolls; profile fields for invoicing and notes.

### 9.2 Sales invoices & credit notes

- **Invoices** — Line items ex-VAT, VAT rate (basis points), issue/due/tax dates, **payment bank** variant (payroll vs consultancy block on PDF), status **unpaid / partial / paid** driven by **allocations + credit notes** vs total.
- **PDF & print** — Invoice PDF API; document title **“INVOICE”** (not “tax invoice”); branding and bank details where applicable.
- **Credit notes** — Issue against an existing invoice (wizard + POST API); per-client numbering; lines with VAT; **CREDIT NOTE** PDFs; caps so credited amount cannot exceed invoice; **balance due** = total − allocated receipts − credits; invoice status recomputation includes credits.
- **Invoice export** — Export API for reporting.

### 9.3 Receipts & allocations

- **Client payments** — Record money received; allocate to one or more invoices; validation against **remaining balance** (after credits).
- **Receipts UI** — `/dashboard/accounts/receipts` for entry and allocation workflow.

### 9.4 Vendors & payables

- **Vendors** — CRUD; contact and currency.
- **Vendor bills** — Lines ex-VAT, VAT rate, due dates, status unpaid/partial/paid; payments recorded against bills via allocations APIs.
- **Vendor payments** — Record payments and allocate to bills; status recompute.

### 9.5 Payroll visibility (accounts)

- **Accounts payroll view** — Filters/perspective tied to `AccountsClient` / billing context; same statutory engine as outsourcing payroll where employees are linked for billing.

### 9.6 Statements

- **Statements** — **Placeholder** module (`/dashboard/accounts/statements`) describing future debtor/creditor statements and aging.

### 9.7 Accounts overview

- **Overview dashboard** — `/dashboard/accounts` and `AccountsOverviewContent`: navigation hub and summaries linking invoices, receipts, vendors, payroll, contracts, etc.

---

## 10. Content management (Insights)

- **CMS-style insights** — Create/edit insights in dashboard (`/dashboard/insights`, `/dashboard/insights/new`, edit pages); API CRUD; optional slug for on-site article; image upload API; public listing and slug pages.

---

## 11. Supporting APIs & utilities (cross-cutting)

- **File uploads** — Resume, generic document, insight images (`/api/upload/...`).
- **Dashboard notifications** — Fetch/mark read for contract and other alerts.
- **Stats** — Aggregate stats endpoint for dashboards.
- **Test / dev routes** — Invite and email test endpoints under `/api/test/...` (for development/support).

---

## 12. Background & scheduled jobs

- **Contract reminders** — `/api/cron/contract-reminders` (with scheduler lock to avoid duplicate runs in serverless environments).

---

## 13. Documentation already in the repo


| File                                     | Purpose                                          |
| ---------------------------------------- | ------------------------------------------------ |
| `README.md`                              | Site stack, setup, Vercel Blob, high-level pages |
| `AUTH.md`                                | Dashboard authentication and Microsoft wiring    |
| `SETUP_GUIDE.md`                         | Environment and ATS setup                        |
| `EMAIL_SETUP.md`                         | SMTP / Microsoft 365 for transactional mail      |
| `PRODUCTION_ENV_CHECKLIST.md`            | Go-live checklist                                |
| `ATS_PROJECT_ANALYSIS_AND_NEXT_STEPS.md` | ATS project notes                                |


---

## 14. Intentional gaps / next-phase areas (summary)

- **Outsourcing leave & attendance UIs** — Schema ready; user-facing management pages not finished.
- **People → Tasks & Performance** — Placeholders only.
- **People → Contract detail** — Stub page; contract **data and reminders** live under Accounts.
- **Accounts statements** — Placeholder.
- **Employer recruitment portal login** — Accounts exist in DB and admin UI; full candidate/client-facing portal app not described in routes reviewed above.

---

*Generated from repository structure and Prisma schema. For deployment and env vars, follow `README.md` and `PRODUCTION_ENV_CHECKLIST.md`.*