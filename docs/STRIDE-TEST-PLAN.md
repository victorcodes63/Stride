# Stride — Test Plan (UAT + automated)

Two layers, both required:
- **Automated** (Cursor builds): unit (logic/math), integration (cross-tenant/RLS), E2E (Playwright
  happy paths), smoke. Runs on every PR — the regression net. See Linear "Test & QA".
- **Manual UAT** (Victor + one staff member): the scripts below. Humans judge logic, UX, and "does
  this work the way a client expects." Log every defect as a Linear issue.

## Roles for UAT
- **Victor** = admin/operator (runs payroll, provisions clients, control plane).
- **Staff member** = employee/manager (ESS: leave, payslip, self-service; manager approvals).
Run each surface with the role that would really use it.

## Environments
1. **Demo** (all modules entitled) — the client-facing sales walkthrough.
2. **App + ESS** (staging tenant with real-ish data) — where clients live.
3. **Control plane** (internal) — where you run the business.

## Defect log template (one Linear issue per failure)
`[surface] path — expected X, got Y. Steps: … Severity: blocker/major/minor.`

---

## Surface 1 — DEMO (entitled to all modules)
Goal: every module opens, has believable data, and a clean happy path — no dead ends, no mock, no
"Coming soon", no Imara/SwiftFreight leaks.
For EACH module (HR, Leave, Time, Payroll, ATS, Performance, Finance, Procurement, Fleet, Assets,
Legal, Reports, ESS): open it → verify it loads with demo data → run its primary action → confirm no
error/empty/placeholder.
Key end-to-end demo story (must flow): login → dashboard → employees → run a payslip → approve leave
→ create invoice → show a fleet trip → show ESS. Time it; a demo that stalls loses deals.

## Surface 2 — APP + ESS (client data)
The real client lifecycle. Run top-to-bottom as a fresh tenant:
1. **Onboard/login** — email-first sign-in resolves the right org; SSO button shows only if configured;
   forgot-password works.
2. **Employees** — add + CSV import; org chart; sensitive fields gated by role.
3. **Payroll** — run a period → validate (missing PIN/NSSF flagged) → generate → approve → payslip
   PDF → statutory exports. **Hand-check the math** against a known-correct payslip (PAYE/NSSF/SHIF/
   Housing/net).
4. **Leave (staff role)** — employee requests leave in ESS → manager approves → balance decrements →
   reflects in payroll.
5. **ESS (staff role)** — log in as employee: view/download payslip, request leave, view profile;
   mobile/PWA.
6. **Finance** — invoice → receipt → expense; statements.
7. **Reports** — headcount, payroll cost, statutory.
8. **Isolation check (critical)** — log in as Org A and Org B (two tenants): confirm A never sees B's
   employees/payroll/anything. Try changing an ID in a URL to another org's record → must be denied.
9. **Entitlement logic** — a module turned off is hidden in nav AND returns 403 on its API.

## Surface 3 — CONTROL PLANE (internal)
Run as operator:
1. **Provision** a new client end-to-end (wizard) → they can log into a working instance with the
   right modules; no manual DB work.
2. **Entitlements** — toggle a module on/off for a customer → it reflects on their instance (sync).
3. **Branding** — set a client's name/logo/colours → reflects on their instance.
4. **Billing** — a Paystack payment marks paid/active; a failed one triggers dunning/suspend.
5. **Lifecycle** — suspend a customer → their access is cut on the instance; reactivate → restored.
6. **Fleet/health** — instance versions, rollout, backup-verified; alerts show failed syncs/past-due.
7. **Staff roles** — a Sales-role user can view but not suspend; every action is audited.

## Cross-cutting logic to verify everywhere
- Tenant isolation (Surface 2 #8) — the highest-stakes check.
- Tier gating enforced server-side, not just hidden UI (try the API for a feature your tier lacks).
- No plaintext passwords in emails (invite/reset links only).
- Money is correct to the cent; dates render in Africa/Nairobi.
- No console errors; loading states don't hang.

## Cadence
- Automated suite: every PR (CI blocks on red).
- Manual UAT: full pass before each surface is called "demo-ready"/"launch-ready", and a smoke pass
  after any significant change. Re-test every logged defect after it's fixed (don't close on trust).
</content>
