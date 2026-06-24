# Application Form Flow, Candidates & Filtering by Requirements

This document describes how the **application form** maps to the **Candidates** list, how **attached documents** (resumes) are stored, and how **job requirements** can be captured so we can **filter candidates** (e.g. by qualifications, years of experience, education) to quickly find those who meet minimum requirements.

---

## 1. Can the way we enter requirements help filter candidates?

**Short answer: yes, but only if we capture requirements in a structured way.**

Right now:

- **Job** has free-text `experience` and `education` (and `requirements` as a list of sentences). That’s great for *display* on the job ad, but we **cannot reliably filter** candidates by “meets minimum experience” or “has required education” because:
  - Candidate has `experience` as a **number** (years) and `education` as a **string**.
  - Job has `experience` and `education` as **free text** (e.g. “5+ years”, “Bachelor’s or equivalent”). We can’t compare “5+ years” to a candidate’s `5` without parsing.

So we need **two layers**:

1. **Structured job requirements (for filtering)**  
   - **Minimum years of experience** (`minYearsExperience`: number, optional).  
   - **Minimum education level** (`educationLevel`: e.g. "High School" | "Bachelor" | "Master" | "PhD" | "Any" or free text).  
   - Optional: **required qualifications/skills** (we already have `skills` on Job; we can filter candidates whose `skills` overlap).

2. **Free-text job requirements (for display)**  
   - Keep the existing `requirements`, `experience`, and `education` fields on the job for the public job ad. Recruiters write rich text; candidates see it. Filtering uses the structured fields above.

With that, when you open the **Candidates** tab (or “Candidates for this job” in Applications), we can:

- Filter by **years of experience** (e.g. “≥ 5”).
- Filter by **education** (keyword match or level).
- Filter by **skills/qualifications** (match job’s `skills` or a chosen list).
- Optionally show a “Meets minimum requirements” badge by comparing candidate data to the job’s `minYearsExperience` and `educationLevel`.

So: **the way we enter requirements on the job posting should be improved** by adding structured fields (min years, education level) in addition to the existing free-text fields. That directly assists in filtering.

---

## 2. Application form → Candidates mapping

- Each **application** is tied to one **Job** and one **Candidate**.
- **Candidate** is identified by **email** (unique).  
  - On submit: **find or create** Candidate by email; update their profile (name, phone, location, experience, education, skills, resume path) from the form.
- **Application** stores: jobId, candidateId, status, coverLetter, resumePath (and optional per-application resume copy), notes.

So:

- **Application form** collects: first name, last name, email, phone, location, years of experience, education (text), skills (comma-separated), resume file, cover letter.
- Backend **POST /api/applications**:
  1. Accepts jobId + candidate payload + optional resume file (or resume URL/path if upload is separate).
  2. Finds or creates **Candidate** by email; updates Candidate with the new data (and resume path).
  3. Creates **Application** (jobId, candidateId, status: pending, coverLetter, resumePath).
- **Candidates** list/tab: shows **all candidates** in the DB (each from at least one application). So “application form flow” and “candidates list” are the same backend: candidates come from applications.

---

## 3. Attached documents (resume)

- **Resume** is stored once per candidate (and optionally copied per application for history).
- Flow:
  1. **Upload**: either a dedicated **POST /api/upload/resume** (multipart) that returns a path/URL, or multipart **POST /api/applications** that accepts the file in the same request.
  2. Store file in **local** `public/uploads` (or a non-public folder and serve via API) or, later, **Vercel Blob**.
  3. Save **path or URL** in `Candidate.resumePath` and in `Application.resumePath` (same value or per-application copy).
- Dashboard **Candidates** and **Applications** UIs show a “Resume” / “Attached documents” link using this path/URL.

---

## 4. Filtering on the Candidates tab

To “easily determine those that meet the minimum requirements” we will:

- **Candidates list** (GET /api/candidates):
  - Query params: `jobId` (candidates who applied to this job), `minExperience`, `maxExperience`, `education` (keyword), `skills` (comma or array), `search` (name/email).
- **Job** structured fields:
  - `minYearsExperience` (Int, optional)
  - `educationLevel` (String, optional) — e.g. dropdown: "Any", "High School", "Bachelor", "Master", "PhD"
- When viewing “Candidates for Job X”, we can:
  - Pre-fill filters from Job X’s `minYearsExperience` and `educationLevel`.
  - Optionally compute a “Meets minimum” flag: candidate.experience >= job.minYearsExperience and (optional) education level match.

So:
- **Posting jobs**: add **minimum years of experience** and **minimum education level** (dropdown + optional free text). That directly assists filtering.
- **Candidates tab**: filters for **years of experience**, **education** (keyword or level), **skills**, plus **job** (applicants for a specific job). Attached documents (resume) are shown as links.

---

## 5. Implementation summary

| Area | What we do |
|------|------------|
| **Job schema** | Add `minYearsExperience` (Int?), `educationLevel` (String?). Keep existing `experience`, `education`, `requirements` for display. |
| **Job forms** | Add optional “Minimum years of experience” and “Minimum education level” (dropdown). |
| **POST /api/applications** | Single endpoint: find/create Candidate by email, create Application, accept resume upload (or path from separate upload). |
| **Resume upload** | POST /api/upload/resume (multipart) → store file, return path; form sends path in POST /api/applications. |
| **GET /api/candidates** | List candidates with filters: jobId, minExperience, maxExperience, education, skills, search. |
| **GET /api/applications** | List applications with job + candidate; filters jobId, status. |
| **PATCH /api/applications/[id]** | Update status (and optional notes). |
| **Dashboard Candidates** | Fetch GET /api/candidates; filters for experience, education, skills; resume link; optional “Meets minimum” when viewing by job. |
| **Dashboard Applications** | Fetch GET /api/applications; PATCH for status; show candidate details and resume. |
| **Application form** | Submit to POST /api/applications (same-origin); upload resume first to /api/upload/resume if needed; map all form fields to Candidate + Application. |

This keeps the application form flow mapped directly to the candidates list, with attached documents (resume) and better job requirements so we can filter and see who meets the minimums.

---

## 6. Apply the migration

If using PostgreSQL (Neon etc.), run the migration for the new job fields:

```bash
npx prisma migrate dev --name add_job_min_experience_education_level
```

Or if the migration file already exists: `npx prisma migrate deploy`.
