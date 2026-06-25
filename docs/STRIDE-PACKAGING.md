# Stride — Packaging & Entitlements (commercial source of truth)

How Stride is sold (standard packages) and how deals get negotiated (per-customer module
mix-and-match). Pairs with `ENTITLEMENT-SYNC.md` (the technical contract). Enforced by the control
plane: **PlanModuleMatrix** = standard package defaults; **SubscriptionModule** = per-customer
overrides (the negotiation layer); seat usage via **UsageSnapshot**.

## 1. The 18 modules, in 3 buckets
- **Foundational** (always on, every plan): `core`, `leave`, `time`, `payroll`, `accounts`, `ess`,
  `reports`, `disciplinary`, `documents`.
- **Horizontal** (quota-limited add-ons): `ats`, `performance`, `training`, `communications`,
  `procurement`, `legal`.
- **Vertical engines** (paid add-on packs): `fleet`, `assets`, `hse`.

## 2. Standard packages (the decision)
| | **Starter** | **Growth** (most popular) | **Enterprise** |
|---|---|---|---|
| Price | KES 18K/mo | KES 55K/mo | Custom |
| Staff band | up to 25 | up to 100 | 100+ / unlimited |
| Foundational | ✅ all | ✅ all | ✅ all |
| Horizontal | up to **2** | up to **4** | **all** |
| Vertical packs | — (add-on only) | **1** included | **full suite** |
| Multi-entity | no | yes | yes |
| M-Pesa / KRA / NSSF / SHIF | ✅ | ✅ | ✅ |
| Support | Email | Priority + onboarding | Dedicated success mgr + SLAs + on-site |

This maps 1:1 to the marketing pricing page (Starter/Growth/Enterprise) and to the bucket quotas
already in `ENTITLEMENT-SYNC.md` (Starter ≤2 horizontal, Growth ≤4, verticals blocked on Starter).
**Seed these into `PlanModuleMatrix`** so every new subscription inherits the right default set.

## 3. Negotiation / mix-and-match (the per-customer layer)
Real deals deviate from the standard. The control plane handles this **without code forks**:
- Each customer's effective access = `entitled (SubscriptionModule) ∧ envLicensed ∧ adminEnabled ∧ accountActive`.
- On the **customer detail page**, sales can toggle any module ON/OFF for that customer beyond the
  plan default — e.g. a Starter client who negotiates the `fleet` pack, or a Growth client who wants
  a 5th horizontal module. The toggle writes a `SubscriptionModule` row; entitlement-sync pushes it
  to the client's cell within 15 min (or on webhook).
- Plan quota (2/4) is the **default**, not a hard cap — an override can exceed it, but should be
  flagged as a negotiated exception (priced accordingly) and audited.

## 4. Add-on pricing (à-la-carte on top of base plan)
Negotiated modules need a price. Proposed model — **Victor to confirm the numbers**:
- Extra **horizontal** module beyond plan: `+KES __/mo` each.
- **Vertical pack** (fleet / assets / hse): `+KES __/mo` each (Starter add-on or Growth 2nd+).
- **Seat overage** beyond band: `+KES __/employee/mo` above the tier limit (or auto-bump to next band).
- Annual prepay discount: `__%`. These live on `SubscriptionModule.price` / `Subscription` so the
  control plane can total a customer's real monthly figure.

## 5. Anything else this raises (decisions + guards)
1. **Seat enforcement** — bands (25/100) need enforcement + a friendly "you're over, upgrade" path
   (UsageSnapshot already tracks headcount). Decide: hard block vs soft overage billing.
2. **Override audit + effective dates** — who turned on what, when, and from when it bills. Essential
   for negotiated deals and disputes.
3. **Vertical packs as the upsell engine** — these are the land-and-expand lever; price them to make
   "add fleet" an easy yes.
4. **Grandfathering** — when standard prices change, existing customers keep their rate until renewal.
5. **Trial / grace** — a time-boxed "all modules on" trial that auto-downgrades to the paid set.
6. **Enterprise = fully bespoke** — no fixed matrix; sales composes the module set + price per deal.
7. **Marketing ↔ reality** — the pricing page must show only what a tier really unlocks (RAV-121).

## 6. Build status
- Models exist (PlanModuleMatrix, SubscriptionModule, Subscription, UsageSnapshot).
- **Done:** PlanModuleMatrix seed from §2 (`plan-standard-packages.ts` + `seed-plans.ts`).
- **Done:** Per-customer module toggle UI on customer subscription tab (§3).
- **Done (placeholder rates):** Monthly estimate with horizontal/vertical/seat add-ons (§4 — confirm KES amounts).
- **Done (soft):** Seat-band warning on customer overview when over limit (§5.1).
- **Done (light):** Module toggle audit log via `systemMeta` (§5.2 — upgrade to dedicated table if needed).

## 7. Marketing "Compare Features" matrix (pricing page)
A public, grouped feature table (SeamlessHR-style: collapsible category rows, ✓ per tier) so
prospects see exactly what each tier unlocks. Built on the pricing page, coral brand. Honesty rule:
✓ only where included by default; horizontal/vertical add-ons show "Add-on" on Starter, not ✓.
Legend: ✓ included · ➕ available as add-on · — not in tier.

| Group / Feature | Starter | Growth | Enterprise |
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
| **Payroll (Kenya)** — runs, payslips, KRA/NSSF/SHIF/Housing | ✓ | ✓ | ✓ |
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
| Staff band | up to 25 | up to 100 | 100+ / unlimited |
| Support | Email | Priority + onboarding | Dedicated success mgr + on-site |

Note: Starter's "➕ add-on" rows reflect that a Starter buyer can negotiate up to 2 horizontal modules
(and vertical packs) via the control plane (§3) — so the table stays honest while showing upgrade room.
</content>
