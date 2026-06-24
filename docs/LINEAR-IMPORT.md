# Stride — Linear Import Structure

> **✅ PUSHED TO LINEAR — 23 June 2026.** Team **`RAV`** (Raven Tech Group Stride Development).
> Live in Linear: **Phase 0 → G projects**, **39 issues** (RAV-62 … RAV-100), `kill-mock` label,
> and milestones **Demo-ready** (Phase A) + **Launch** (Phase G). Phase 0 (multi-tenant re-foundation)
> was added per the 23 Jun architecture reversal and **blocks** the module phases.
> Live numbering: Phase 0 = RAV-62–67 · A = 68–73 · B = 74–78 · C = 79–83 · D = 84–87 ·
> E = 88–92 · F = 93–96 · G = 97–100. The `0.1`/`A1` codes below are stable references; Linear's
> `RAV-NN` is the canonical id. Existing projects (Control Plane, Marketing Site) were kept untouched.

This is `STRIDE-MASTER-PLAN.md` reshaped for Linear: **Projects (= phases)** + **Issues (=
workstreams)** with labels, priorities and ordering. It mirrors the master plan exactly.

## Workspace conventions

- **Team:** `Stride` (key `STR`). One team for the product.
- **Projects** = phases A–G + a `Verticals` project for Phase F.
- **Labels:** `phase:A`…`phase:G`, `area:hr`, `area:payroll`, `area:finance`, `area:ops`,
  `area:marketing`, `area:platform`, `type:model`, `type:ui`, `type:integration`, `kill-mock`,
  `compliance`.
- **Milestones:** `Demo-ready` (Phase A done) and `Launch` (Phases A–B + G done).
- **Priority:** Urgent for kill-mock + M-Pesa; High for the rest of A/B; Medium C–F; mixed in G.
- **Cursor convention:** issue title carries the STR-XX id so prompts read _"Work STR-A2."_

---

## Project: Phase A — Core HR settled  · Milestone: Demo-ready · Priority: Urgent/High

| Issue | Title | Labels | Priority | Key deliverables (description) |
|-------|-------|--------|----------|--------------------------------|
| STR-A1 | M-Pesa disbursement v1 | area:payroll, type:integration, compliance | Urgent | `PayrollDisbursementProvider` interface; bulk-transfer API (sandbox); payment status per employee. Done = disbursement demonstrable in sandbox. |
| STR-A2 | Performance management (real) | area:hr, type:model, kill-mock | Urgent | Prisma `PerformanceCycle/Goal/Review/ReviewRating/Feedback`; cycle setup; manager + self review; ESS; remove mock `/dashboard/performance`. Done = full cycle for 50 seed employees. |
| STR-A3 | Leave admin unify | area:hr, type:ui | High | Single Leave hub (Employee/Staff tabs); fix `/outsourcing/leave` routing; accrual; team calendar; liability report. Done = no "Coming soon" in leave. |
| STR-A4 | Payroll run wizard | area:payroll, type:ui | High | Period → validate (PIN/NSSF/bank) → generate → review → approve → export/disburse; prior-month variance. Done = approved run w/ audit trail. |
| STR-A5 | Marketing copy audit | area:marketing | High | Badge every module/vertical Live/Partial/Roadmap; soften Procurement/Projects. Done = getstride.co.ke truthful. |
| STR-A6 | Demo instance hardening | area:platform, kill-mock | Urgent | Demo on marketing site; Kenyan SME seed (~40 staff); verify end-to-end path. **Done = Demo-ready milestone.** |

## Project: Phase B — Finance & Legal credible · Milestone: Launch · Priority: High

| Issue | Title | Labels | Deliverables |
|-------|-------|--------|--------------|
| STR-B1 | Accounts statements | area:finance, kill-mock | Replace placeholder; debtor/creditor ageing; statement PDF email. |
| STR-B2 | Billing automation | area:finance, type:integration | Recurring invoices from headcount × rate card; payroll run → invoice draft (markup). |
| STR-B3 | Legal surface unify | area:hr, type:ui | One "Legal & compliance" nav: contracts + credentials + company docs. |
| STR-B4 | Obligation register | area:hr, type:model | Renewal dates, owners, alerts (extends contracts/credentials). |
| STR-B5 | M-Pesa reconciliation | area:finance, type:integration | Match disbursements + receipts to payroll/invoices. |

## Project: Phase C — Procurement · Priority: Medium

| Issue | Title | Labels | Deliverables |
|-------|-------|--------|--------------|
| STR-C1 | Procurement data model | area:finance, type:model | `PurchaseRequest`, `PurchaseOrder` (LPO), `GoodsReceipt`, approval chain. |
| STR-C2 | Procurement workflow | area:finance, type:ui | Request → approve → LPO PDF → vendor bill link. |
| STR-C3 | Spend dashboard | area:finance, type:ui | By department, vendor, budget line. |
| STR-C4 | Procurement licensing | area:platform | `MODULE_PROCUREMENT`, nav, route guards, entitlement bucket. |
| STR-C5 | Procurement ESS | area:hr, type:ui | Staff submit PR from mobile (optional). |

## Project: Phase D — Projects · Priority: Medium

| Issue | Title | Labels | Deliverables |
|-------|-------|--------|--------------|
| STR-D1 | Projects data model | area:ops, type:model | `Project`, `Milestone`, `ProjectTask`, time/cost allocation. |
| STR-D2 | Project budget link | area:finance, type:integration | Tie to accounts budgets; actuals from payroll + AP + expenses. |
| STR-D3 | Projects dashboard | area:ops, type:ui | Project board, burn rate, deliverable status. |
| STR-D4 | Construction seed | area:ops | Site/project template; vertical "coming soon" → available. |

## Project: Phase E — Admin completion · Priority: Medium

| Issue | Title | Labels | Deliverables |
|-------|-------|--------|--------------|
| STR-E1 | Facilities | area:ops, type:model | Sites/locations, leases, maintenance tickets (light CMMS). |
| STR-E2 | Board & governance | area:ops, type:model | Resolution register, minutes, action tracking. |
| STR-E3 | Fleet polish | area:ops | Fuel/maintenance logs, driver/partner registers. |
| STR-E4 | Fleet ESS | area:ops, type:ui | Driver trip updates + POD capture on mobile. |
| STR-E5 | HSE (real) | area:ops, type:model, kill-mock | `HseIncident/HseAction`, investigation workflow; replace mock. |

## Project: Verticals (Phase F) · Priority: Medium · parallel after A

| Issue | Title | Labels | Deliverables |
|-------|-------|--------|--------------|
| STR-F1 | SACCO pack | compliance, type:model | Member ledger, BOSA/FOSA, dividend run, SASRA templates. Depends STR-A1/A4. |
| STR-F2 | Healthcare pack | compliance | Clinical rota rules, licence gate on shifts, NHIF hooks. Depends A time. |
| STR-F3 | Energy pack | compliance | Permit tracking, multi-entity HSE rollup. Depends STR-E5. |
| STR-F4 | Construction pack | area:ops | Site hierarchy, plant assets, subcontractor AP. Depends STR-D1. |

## Project: Phase G — Launch hardening · Milestone: Launch · Priority: High

| Issue | Title | Labels | Deliverables |
|-------|-------|--------|--------------|
| STR-G1 | Quality bar | area:platform, kill-mock | No mock pages with `DEMO_MODE=false`; lint/build clean. |
| STR-G2 | Sales enablement | area:marketing | Battlecard, pricing page, 30-min demo script, security one-pager. |
| STR-G3 | Operator docs | area:marketing | HR admin guide, ESS user guide, implementation checklist. |
| STR-G4 | Reliability | area:platform | Backup restore tested on Neon; support channel + SLA; fleet registry current. |

---

## Dependencies to set in Linear

- STR-A6 blocked by A1–A4 (demo can't be clean until mock gone + flows real).
- Milestone **Demo-ready** = all Phase A issues done.
- Milestone **Launch** = Phase A + Phase B + Phase G done.
- STR-D2 blocked by STR-B1/B2 (needs finance actuals).
- STR-F1 blocked by STR-A1, STR-A4; STR-F3 blocked by STR-E5; STR-F4 blocked by STR-D1.

> **To push:** connect Linear (button above in chat), then tell me "push the roadmap to Linear."
> I'll create the team/projects/issues/labels/milestones and wire the dependencies above.
</content>
