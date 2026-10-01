# Stride — Packaging & Entitlements (commercial source of truth)

How Stride is sold (standard packages) and how deals get negotiated (per-customer module
mix-and-match). Pairs with `ENTITLEMENT-SYNC.md` (the technical contract). Enforced by the control
plane: **PlanModuleMatrix** = standard package defaults; **SubscriptionModule** = per-customer
overrides (the negotiation layer); seat usage via **UsageSnapshot**.

## 1. The 28 capabilities, in 3 buckets
- **Foundational** (always on, every plan): `core`, `leave`, `time`, `payroll`, `accounts`, `ess`,
  `reports`, `disciplinary`, `documents`.
- **Horizontal** (quota-limited add-ons): `ats`, `performance`, `training`, `communications`,
  `procurement`, `legal`, `sales`, `inventory`, `projects`, `operations`, `outsourcing`,
  `assessments`.
- **Vertical engines** (paid add-on packs): `fleet`, `assets`, `hse`, `sacco`, `healthcare`,
  `energy`, `construction`.

## 2. Standard packages (the decision)
| | **Essentials** | **Growth** | **Enterprise** |
|---|---|---|---|
| Price | KES 350 / employee / mo | KES 550 / employee / mo | Custom |
| Team size | any — no minimum, no cap | any — no minimum, no cap | 150+ / regulated / multi-entity |
| Foundational | ✅ all | ✅ all | ✅ all |
| Horizontal | up to **2** | up to **4** | **all** |
| Vertical packs | — (add-on only) | **1** included | **full suite** |
| Multi-entity | no | yes | yes |
| M-Pesa / KRA / NSSF / SHIF | ✅ | ✅ | ✅ |
| Support | Email | Priority + onboarding | Dedicated success mgr + SLAs + on-site |

This maps 1:1 to the marketing pricing page (Essentials/Growth/Enterprise) and to the bucket quotas
already in `ENTITLEMENT-SYNC.md` (Essentials ≤2 horizontal, Growth ≤4, verticals blocked on Essentials).
**Seed these into `PlanModuleMatrix`** so every new subscription inherits the right default set.

Plans differ by **features only**. Pricing is per active employee per month (`app/src/lib/pricing.ts`),
so there is no band to enforce and no seat to purchase — see `docs/PRICING-SHEET.md`. Essentials is the
plan whose runtime planId is still `starter`.

## 3. Negotiation / mix-and-match (the per-customer layer)
Real deals deviate from the standard. The control plane handles this **without code forks**:
- Each customer's effective access = `entitled (SubscriptionModule) ∧ envLicensed ∧ adminEnabled ∧ accountActive`.
- On the **customer detail page**, sales can toggle any module ON/OFF for that customer beyond the
  plan default — e.g. an Essentials client who negotiates the `fleet` pack, or a Growth client who wants
  a 5th horizontal module. The toggle writes a `SubscriptionModule` row; entitlement-sync pushes it
  to the client's cell within 15 min (or on webhook).
- Plan quota (2/4) is the **default**, not a hard cap — an override can exceed it, but should be
  flagged as a negotiated exception (priced accordingly) and audited.

## 4. Add-on pricing (à-la-carte on top of base plan)
Negotiated modules need a price. Rates in `docs/PRICING-SHEET.md` §2:
- Extra **horizontal** module beyond plan: `+KES 5,000/mo` each.
- **Vertical pack** (fleet / assets / hse): `+KES 15,000/mo` each (Essentials add-on or Growth 2nd+).
- Annual prepay discount: `10%`. These live on `SubscriptionModule.price` / `Subscription` so the
  control plane can total a customer's real monthly figure.
- **No seat overage.** Headcount is the base price (employees × plan rate), so there is nothing to meter
  above a band. The control-plane `seatOveragePerEmployeeMonthly` constant is retired.

## 5. Anything else this raises (decisions + guards)
1. **Headcount metering** — `UsageSnapshot` headcount is now the billing input, not a limit to police.
   The control plane must multiply it by the plan rate; the "you're over your band, upgrade" path is gone.
2. **Override audit + effective dates** — who turned on what, when, and from when it bills. Essential
   for negotiated deals and disputes.
3. **Vertical packs as the upsell engine** — these are the land-and-expand lever; price them to make
   "add fleet" an easy yes.
4. **Grandfathering** — when standard prices change, existing customers keep their rate until renewal.
5. **Trial / grace** — a time-boxed "all modules on" trial that auto-downgrades to the paid set.
6. **Enterprise = fully bespoke** — no fixed matrix; sales composes the module set + price per deal.
7. **Marketing ↔ reality** — the pricing page must show only what a plan really unlocks (RAV-121).

## 6. Build status
- Models exist (PlanModuleMatrix, SubscriptionModule, Subscription, UsageSnapshot).
- **Done:** PlanModuleMatrix seed from §2 (`plan-standard-packages.ts` + `seed-plans.ts`).
- **Done:** Per-customer module toggle UI on customer subscription tab (§3).
- **Done (placeholder rates):** Monthly estimate with horizontal/vertical add-ons (§4).
- **Open:** Control-plane estimate must become `headcount × plan rate` and drop the seat-band warning (§5.1).
- **Done (light):** Module toggle audit log via `systemMeta` (§5.2 — upgrade to dedicated table if needed).

## 7. Marketing "Compare Features" matrix (pricing page)
A public, grouped feature table (SeamlessHR-style: collapsible category rows, ✓ per plan) so
prospects see exactly what each plan unlocks. Built on the pricing page, coral brand. Honesty rule:
✓ only where included by default; horizontal/vertical add-ons show "Add-on" on Essentials, not ✓.
Legend: ✓ included · ➕ available as add-on · — not on this plan.

| Group / Feature | Essentials | Growth | Enterprise |
|---|---|---|---|
| **Core HR (HRIS)** — records, profiles, org structure, custom fields, document storage, company branding, unique URL | ✓ | ✓ | ✓ |
| Employee self-service (ESS) + mobile PWA | ✓ | ✓ | ✓ |
| Notifications, email alerts, announcements | ✓ | ✓ | ✓ |
| Workflows & approvals | ✓ (basic) | ✓ (advanced) | ✓ (advanced) |
| Audit trail | ✓ | ✓ | ✓ |
| Standard + custom reporting | ✓ | ✓ | ✓ |
| **Leave & time-off** — policies, balances, calendar/planner, approvals | ✓ | ✓ | ✓ |
| **Time & attendance** — rota/scheduling, attendance | ✓ | ✓ | ✓ |
| Biometric device integration | ➕ | ✓ | ✓ |
| Geo mobile clock-in | ➕ | ✓ | ✓ |
| **Payroll (Kenya)** — runs, payslips, KRA PAYE, NSSF and SHIF | ✓ | ✓ | ✓ |
| Housing Levy | ✓ | ✓ | ✓ |
| M-Pesa disbursements | ✓ | ✓ | ✓ |
| Multi-entity payroll | — | ✓ | ✓ |
| **Finance** — invoicing (AR), vendor bills (AP), expenses, petty cash, budgets | ✓ | ✓ | ✓ |
| Statements / ageing, M-Pesa reconciliation | ➕ | ✓ | ✓ |
| **Disciplinary & grievance** | ✓ | ✓ | ✓ |
| **Recruitment / ATS** — jobs, pipeline, interviews, careers | ➕ | ✓ | ✓ |
| Candidate assessments | ➕ | ✓ | ✓ |
| **Performance** — goals, reviews, cycles | ➕ | ✓ | ✓ |
| **Training / learning** | ➕ | ✓ | ✓ |
| **Procurement** — PR → LPO → GRN, spend | ➕ | ✓ | ✓ |
| **Legal & compliance** — contracts, credentials, obligations | ➕ | ✓ | ✓ |
| **Communications** | ➕ | ✓ | ✓ |
| Horizontal modules included | up to 2 | up to 4 | all |
| **Vertical packs** — Fleet, Assets, HSE | ➕ | 1 included | full suite |
| **Multi-entity / regional cells** | — | ✓ | ✓ |
| **Dedicated instance + custom integrations + SLAs** | — | — | ✓ |
| Support | Email | Priority + onboarding | Dedicated success mgr + on-site |

Note: Essentials' "➕ add-on" rows reflect that an Essentials buyer can negotiate up to 2 horizontal modules
(and vertical packs) via the control plane (§3) — so the table stays honest while showing upgrade room.
</content>
