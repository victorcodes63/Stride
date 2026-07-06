# Stride — Performance Management sub-module (spec)

Balanced-Scorecard performance management under HR, driven by Job Descriptions. This is a
make-or-break module for HR clients — it must be as specialised for performance as the ATS is for
recruitment. All tables org-scoped + RLS (see Tenant Isolation Hardening).

## 1. Core idea
The **JD is the source of truth**; the **scorecard is generated from it**. Each JD (per the Stabex
manual's 10-section structure) already contains: Job Purpose, KRAs, KPIs, Competencies (with required
proficiency 1–5), Qualifications, Relationships. That maps 1:1 onto a Balanced Scorecard.

## 2. Balanced Scorecard model
Two axes:
- **Results ("what")** — KRAs/KPIs mapped onto 4 BSC perspectives (Financial, Customer/Stakeholder,
  Internal Process, Learning & Growth), each weighted; targets per KPI.
- **Competencies ("how")** — required vs assessed proficiency level → gap.
Final score = configurable blend (default 70% results / 30% competencies). Rating scale configurable.
Method is pluggable: BSC first; leave room for OKR / simple-KPI / 9-box as alternate methods per org.

## 3. JD lifecycle — the pluggable part (client choice)
Clients differ; support three JD paths, chosen per org in Company Setup:

**A. Manual entry (no AI).** Structured editor for the 10 JD sections — the client (or Eagle HR)
types/pastes JDs. Always available, all tiers. Some clients will never want AI near their JDs.

**B. Stride-provided parsing.** Upload .docx/PDF → Stride's built-in extractor (LLM) → structured
draft → **human confirm** before save. Convenience default.

**C. Bring-your-own AI parser (BYO).** For clients who want their own model/provider: a pluggable
`JdParserProvider` interface. Config per org: provider (Stride default | OpenAI | Azure OpenAI |
Anthropic | custom endpoint), API key (stored per-org, encrypted), prompt/template override. The app
calls the client's configured parser; output flows through the SAME structured-confirm step.
Enterprise-gated. **Never send JD/employee data to any AI unless the org has explicitly enabled a
parser and consented** — manual path sends nothing anywhere.

**Storage:** original uploaded file (Vercel Blob, org-scoped path) + parsed structured records +
version history. JDs are versioned; a published scorecard/review freezes the JD version it used.

## 4. Data model (Prisma, org-scoped + RLS)
- JD: `JobDescription` (versioned, links JobTitle/Grade), `JobKRA`, `JobKPI`, `JobCompetency`
  (requiredLevel 1–5), `JdDocument` (blob ref), `JdParserConfig` (per-org: mode A/B/C, provider, key ref).
- Scorecard: `ScorecardTemplate` (per role+grade), `ScorecardPerspective` (BSC, weight),
  `ScorecardMeasure` (from KPI: target, weight, auto/manual source), `CompetencyRequirement`.
- Cycle: `PerformanceCycle` (annual/quarterly/probation), `CycleParticipant`, `Objective` (from KPI),
  `ResultRating`, `CompetencyRating`, `Review` (self|manager|calibration), `Feedback`, `ReviewScore`
  (frozen final).

## 5. Evaluation flow
Cycle setup → instantiate each participant's scorecard from their role template → **self-assessment**
→ **manager rating** (results + competencies, with evidence) → **calibration** (HR normalises) →
**final score** → ESS view → reporting.

## 6. AI evaluation (human-in-the-loop, optional per org)
Two jobs, both assistive: (a) JD → scorecard draft; (b) evidence-assisted rating — suggest a KPI
rating from submitted evidence + flag missing evidence; competency gap analysis. AI proposes, the
manager decides. Uses the org's parser/AI config (§3C) or is off entirely.

## 7. The differentiator — auto-measured KPIs (one data layer)
Because performance shares the platform with payroll/ATS/finance/fleet, KPIs can be auto-populated:
time-to-hire (ATS), budget variance (finance), delivery/on-time % (fleet), attendance (time),
headcount/turnover (HR). Turns scorecards from self-report into evidence. Standalone PM tools can't
do this — it's the "specialised, integrated" wedge.

## 8. Specialisation (what makes it boutique, like the ATS)
- JD library per org (the Stabex manual = 83 roles / 13 divisions as the reference pack).
- Competency framework + proficiency descriptors reusable across roles.
- Cascading objectives (org → division → role → individual).
- Calibration + 9-box + distribution analytics for EXCO.
- Probation cycles, PIP workflow, multi-rater/360 (later).
- Method pluggability (BSC / OKR / KPI-only) per org.

## 9. Tiering
- Manual JD + basic KPI review — all HR tiers.
- Full BSC + competencies + calibration + auto-measured KPIs — Growth+.
- BYO AI parser + 360/PIP + advanced analytics — Enterprise.

## 10. Non-negotiables
- Org-scoped + RLS on every table.
- Versioned + frozen reviews (JD changes never rewrite history).
- No data leaves to any AI without explicit per-org opt-in; manual path is fully offline-of-AI.
- Replaces the mock performance page (expands A2 / RAV-69).
</content>
