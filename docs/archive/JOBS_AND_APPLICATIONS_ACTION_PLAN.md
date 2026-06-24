# Jobs & Applications – Action Plan (Public Board ↔ ATS Dashboard ↔ Database)

This plan makes the database the single source of truth for jobs and applications: from the **public job board** through **apply flow** to **ATS job management** and **applications dashboard**.

---

## Current State (Summary)

| Area | Status | Notes |
|------|--------|--------|
| **Database** | ✅ Connected | Neon; Client, Job, Candidate, Application tables exist. |
| **GET /api/jobs** | ✅ Uses DB | When `DATABASE_URL` set, returns jobs from DB; filters (activeOnly, keyword, location, category); masks company as "Confidential" when needed. |
| **GET /api/jobs/[id]** | ✅ Uses DB | Public and internal (edit) modes; masks company for public. |
| **POST /api/jobs** | ✅ Uses DB | Dashboard "Post a job" creates job in DB. |
| **PATCH /api/jobs/[id]** | ✅ Uses DB | Dashboard edit updates job in DB. |
| **Public job board** | ✅ API only | `DynamicJobListings` calls `getJobListings()` → `/api/jobs?activeOnly=true`. No mock fallback; on API error shows "Unable to load jobs" + retry. |
| **Job detail / apply page** | ✅ API only | `getJobById()` → `/api/jobs/[id]`. No mock fallback; 404/error returns `null` → "Job not found". |
| **Apply form submission** | ❌ Not persisted | `createCandidate` and `submitApplication` in ats-api **only call external ATS** when `apiKey` is set. With same-origin (no key), they **simulate** and return mock – nothing is saved to DB. |
| **POST /api/candidates** | ❌ Missing | No route. |
| **POST /api/applications** | ❌ Missing | No route. |
| **Dashboard applications** | ❌ Mock only | Uses `getMockApplications()`; not wired to DB. |

---

## Goals

1. **Jobs:** Public board and dashboard both use the same DB (already true when DB is set). Remove or narrow mock fallbacks so production never shows fake jobs.
2. **Apply flow:** Submitting an application creates a **Candidate** and an **Application** in the DB and (optional) sends "application received" email.
3. **Dashboard applications:** List and update applications from the DB instead of mock data.

---

## Phase 1: Jobs – Public Board ↔ Dashboard (Single Source of Truth) ✅

**Goal:** Public job board and dashboard job management both read/write only the database; no mock jobs in production.

| Step | Task | Details |
|------|------|--------|
| 1.1 | **Public board – no mock fallback** | ✅ Done. In `ats-api.ts`, `getJobListings` no longer falls back to mock; on error it throws so the UI shows "Unable to load jobs" and a retry button. Mock job data removed. |
| 1.2 | **Job detail – no mock fallback** | ✅ Done. In `ats-api.ts`, `getJobById` returns `null` on 404/error; apply page shows "Job not found". |
| 1.3 | **Verify dashboard → public** | Confirm: create a job in dashboard (active), then open public careers page – it should appear. Edit/deactivate in dashboard – public list should reflect it. |
| 1.4 | **Optional: seed or document** | If DB is empty, add 1–2 jobs via dashboard or document "Add jobs from Dashboard → Job openings" so the public board is not empty for testing. |

**Outcome:** Public board and dashboard are fully driven by the DB; no fake jobs.

---

## Phase 2: Apply Flow – Persist to Database

**Goal:** Submitting an application from the public form creates a Candidate and an Application in the DB.

| Step | Task | Details |
|------|------|--------|
| 2.1 | **POST /api/applications** | One endpoint that: (1) accepts payload (jobId, candidate: { firstName, lastName, email, phone, location?, experience?, skills?, resumePath? }, coverLetter?, resumePath?). (2) Finds or creates **Candidate** by email (unique). (3) Creates **Application** (jobId, candidateId, status: pending, coverLetter, resumePath). (4) Returns application (and candidate id). Use Prisma; fallback to in-memory only when no DB. |
| 2.2 | **Resume upload** | Decide storage: e.g. **local** `public/uploads` or **Vercel Blob** (later). For now: optional multipart in POST /api/applications or separate POST /api/upload-resume returning path; store path in Candidate and Application. Minimal first step: accept `resumePath` or `resumeUrl` in payload (e.g. base64 or URL) or skip file upload and only store link/path from a simple upload endpoint. |
| 2.3 | **Wire form to API** | In `ats-api.ts`: when calling same-origin (no external ATS), call **POST /api/applications** with one payload (candidate + coverLetter + jobId + resume path). Update `JobApplicationForm` to use this (e.g. submit one object to `/api/applications`). Remove dependency on `apiKey` for public apply. |
| 2.4 | **Optional: "Application received" email** | After creating the application, call existing Nodemailer (or send via API) to send a confirmation email to the candidate. Can be Phase 3. |

**Outcome:** Applications from the public site are stored in the DB and visible in the dashboard (once Phase 3 is done).

---

## Phase 3: Dashboard Applications – List and Update from DB

**Goal:** Dashboard Applications tab shows real applications from the DB and allows status updates.

| Step | Task | Details |
|------|------|--------|
| 3.1 | **GET /api/applications** | Returns list of applications with candidate and job details (join). Support query params: jobId, status. Use Prisma when DB set; otherwise in-memory or empty. |
| 3.2 | **PATCH /api/applications/[id]** | Update application status (e.g. pending → shortlisted → hired). Use Prisma when DB set. |
| 3.3 | **Dashboard applications page** | Replace `getMockApplications()` with fetch to GET /api/applications. Use PATCH /api/applications/[id] for status dropdown/side panel updates. |
| 3.4 | **Candidates list** | Dashboard Candidates tab: optionally wire to GET /api/candidates (list from DB) or derive from GET /api/applications (unique candidates). Can be a separate GET /api/candidates that returns distinct candidates from DB. |

**Outcome:** Staff see real applications and candidates and can update status in the dashboard.

---

## Phase 4: Clean-up and Polish

| Step | Task | Details |
|------|------|--------|
| 4.1 | **Remove or guard mock jobs** | In ats-api (and anywhere else): ensure mock job listings are only used in dev or when API is explicitly unavailable; avoid showing mock in production when DB is the source of truth. |
| 4.2 | **Error handling** | Public board and apply page: show clear messages when API fails (e.g. "Unable to load jobs", "Job not found", "Failed to submit application"). |
| 4.3 | **Optional: application email** | Send "Application received" and "Status updated" emails using existing SMTP setup. |

---

## Implementation Order

1. **Phase 1** – Jobs only (public + dashboard already use DB; remove mock fallbacks, verify flow).
2. **Phase 2** – Apply flow (POST /api/applications, resume handling, wire form).
3. **Phase 3** – Dashboard applications (GET/PATCH applications, wire UI).
4. **Phase 4** – Clean-up and optional email.

---

## Quick Reference: API Routes After Implementation

| Method | Route | Purpose |
|--------|-------|--------|
| GET | /api/jobs | List jobs (public: activeOnly=true; dashboard: no filter). |
| GET | /api/jobs/[id] | Job detail (public: mask company; internal: ?internal=true for edit). |
| POST | /api/jobs | Create job (dashboard). |
| PATCH | /api/jobs/[id] | Update job (dashboard). |
| POST | /api/applications | Submit application (create/find candidate + create application). |
| GET | /api/applications | List applications (dashboard; optional jobId, status). |
| PATCH | /api/applications/[id] | Update application status (dashboard). |
| GET | /api/candidates | (Optional) List candidates for dashboard. |

Implementing **Phase 1** first keeps jobs fully DB-driven; then **Phase 2** makes the apply form functional; then **Phase 3** makes the dashboard applications tab real.
