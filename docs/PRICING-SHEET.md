# Stride Standard Pricing Sheet (RAV-148)

**Effective:** October 2026  
**Model:** Per active employee, per month  
**Currency:** KES (Kenya Shillings), ex-VAT unless stated  
**Policy:** Quote from this sheet for all **new** prospects. Custom flat rates (e.g. legacy Stabex/Eagle HR deals) are exceptions documented in the control plane.

---

## 1. Plans (per active employee / month)

| Plan | Rate (KES / employee / mo) | Positioning | Notes |
|------|----------------------------|-------------|-------|
| **Essentials** | **350** | Any team size | HR & Payroll + Finance foundational; pick **2** horizontal plug-ins |
| **Growth** | **550** | Typically 50+ staff | **4** horizontal plug-ins; **1** vertical pack included; multi-entity |
| **Enterprise** | Custom | 150+ staff, regulated or multi-entity | All modules, dedicated success, SLAs, bespoke rollout |

**There are no minimum charges and no headcount caps.** Essentials and Growth differ by features, never by
size — a 6-person consultancy and a 400-person group can both buy either plan. Positioning in the table is
guidance for sales, not a limit enforced in product or billing.

### Billing unit

Active employee records in a month, aggregated across all of the customer's entities. Leavers stop counting
the month after their exit date. No seat purchase, no band to upgrade out of: the invoice moves with
headcount in the following month's billing run.

### Worked examples

| Active employees | Essentials | Growth |
|------------------|-----------|--------|
| 10 | 3,500 | 5,500 |
| 25 | 8,750 | 13,750 |
| 60 | 21,000 | 33,000 |
| 150 | 52,500 | 82,500 |

Above 150 staff, quote Enterprise rather than the published rate.

Source of truth in code: `app/src/lib/pricing.ts` (rates, calculator bounds, FAQ, offer copy).
Marketing surfaces and the public page read `PRICING_PLANS` from it; no price is written out by hand.

---

## 2. Module add-ons (à-la-carte)

Applies when a customer negotiates packs beyond their plan's included module quota.

| Add-on type | Rate (KES/mo) | Code reference |
|-------------|---------------|----------------|
| Extra **horizontal** module | **5,000** | `ADDON_PRICING_CENTS.horizontalModuleMonthly` |
| **Vertical pack** (Fleet / Assets / HSE) | **15,000** each | `ADDON_PRICING_CENTS.verticalPackMonthly` |

**Annual prepay discount:** 10% (`ADDON_PRICING_CENTS.annualPrepayDiscountPercent`).

**Retired with the move to per-employee pricing:** seat overage (`seatOveragePerEmployeeMonthly`) and the
banded payroll / generic module add-ons. There is no band to overflow, so there is nothing to meter as
overage — headcount is the base price. See §8 for the control-plane constants still to be removed.

---

## 3. What's included per plan

Aligned with `docs/STRIDE-PACKAGING.md` and the `/pricing` compare matrix.

### Essentials (KES 350 / employee / mo)
- Foundational: Core HR, Leave, Time, Payroll, Accounts, ESS, Reports, Disciplinary, Documents
- Horizontal quota: **2** plug-ins (e.g. Procurement, Legal, ATS)
- Vertical packs: add-on only
- Statutory: KRA PAYE, NSSF, SHIF, Housing Levy; M-Pesa disbursements
- Support: Email

### Growth (KES 550 / employee / mo)
- Foundational: all Essentials modules
- Horizontal quota: **4** plug-ins (ATS, Performance, Training, Procurement, Legal, Communications, …)
- Vertical: **1** pack included (Fleet, Assets, or HSE)
- Multi-entity, priority support + onboarding

### Enterprise (Custom)
- All modules, dedicated success manager, custom integrations, SLAs, on-site implementation
- Rate and rollout per signed order form

---

## 4. Free parallel payroll run (standing offer)

Every new Essentials or Growth prospect is entitled to one **free payroll cycle run in parallel** with their
current process: we migrate the data, run one full cycle, and the prospect checks PAYE, NSSF, SHIF, Housing
Levy and net pay line by line. If they proceed, the subscription starts from the next cycle.

Available for teams of **10 or more** (`FREE_PARALLEL_RUN.minEmployees`). Do not promise it below that size
without sign-off — the migration effort is not recoverable on a small per-employee invoice.

---

## 5. International (Kenyan payroll for foreign employers)

Foreign companies employing staff in Kenya are billed in **USD from $13 per employee per month**
(`INTERNATIONAL_PRICING.fromUsdPerEmployee`). Scope, FX terms and invoicing entity are confirmed per deal.

---

## 6. HR outsourcing / BPO billing (separate from platform SaaS)

For Eagle HR-style managed payroll and end-client billing:

| Model | Formula | Example |
|-------|---------|---------|
| Per head | `headcount × unit rate` | 25 employees × KES 3,500 = **87,500/mo** |
| Flat monthly | fixed fee | KES 15,000/mo |
| Percentage markup | `% of payroll gross` | 5% × KES 1M gross = **50,000/mo** |
| Payroll pass-through | net pay + NITA + management fee | See `billing-automation.ts` golden cases |

Rate cards live on each `OutsourcingClient` in the product; golden tests in `qa-01-critical-logic.test.ts`.
This section is unchanged by the platform repricing — outsourcing rate cards are per-client commercial terms.

---

## 7. Quoting rules for sales

1. **Multiply:** active employee count (or projected count at go-live) × plan rate. There is no floor.
2. **Pick the plan on features**, not size — Growth is the answer when the customer needs more plug-ins, a
   vertical pack or multi-entity, whatever their headcount.
3. **Lead with the free parallel run** for teams of 10+; it is the primary conversion motion.
4. **Quote Enterprise above 150 staff**, or for regulated / multi-entity groups at any size.
5. **Add module line items** only for packs beyond the plan quota — use add-on rates in §2.
6. **Document exceptions** in the control plane (`SubscriptionModule` overrides + notes) when deviating.
7. **Do not default to custom flat rates** for new logos — Stabex KES 150K all-inclusive remains
   grandfathered until renewal repricing.
8. **Cross-check Eagle HR repricing** (RAV-138) against per-employee totals before renewal conversations.

---

## 8. Related artefacts

| Document / file | Purpose |
|-----------------|---------|
| `docs/STRIDE-PACKAGING.md` | Entitlement buckets + negotiation layer |
| `app/src/lib/pricing.ts` | **Canonical** rates, billing unit, calculator, offer copy, pricing FAQ |
| `app/src/lib/marketing-pricing-entitlements.ts` | Plan → module mapping (keyed by runtime planId) |
| `control-plane/src/lib/plan-packs.ts` | Plan defaults — **still carries per-plan headcount limits to remove** |
| `control-plane/src/lib/addon-pricing.ts` | MRR estimate calculator — **drop `seatOveragePerEmployeeMonthly`; base estimate on headcount × plan rate** |
| `control-plane/src/components/SubscriptionPricingPanel.tsx` | Per-customer live estimate — **must multiply `UsageSnapshot` headcount by the plan rate** |

The three `control-plane/*` files live in a separate repository (`stride-control-plane`) and are **not**
updated by this repricing. Treat them as open work before billing matches this sheet.

**Plan id note:** the public name **Essentials** maps to the runtime planId `starter`
(`DEPLOYMENT_TIER=starter`), which is unchanged so the entitlement-sync contract keeps working. The app also
accepts `essentials` as an alias.

---

## 9. Revision log

| Date | Change |
|------|--------|
| 2026-07-06 | RAV-148 — Initial standard sheet published; aligns Platform + Modules decision with code anchors |
| 2026-10-01 | Moved from size-banded platform fees (Starter KES 18K / Growth KES 55K / Business / Enterprise) to **per active employee** pricing: Essentials KES 350, Growth KES 550, no minimums and no headcount caps. Starter renamed Essentials; seat overage and banded module add-ons retired; free parallel payroll run and USD international rate documented |
