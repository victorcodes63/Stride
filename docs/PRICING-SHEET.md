# Stride Standard Pricing Sheet (RAV-148)

**Effective:** July 2026  
**Model:** Platform + Modules, banded by organisation size  
**Currency:** KES (Kenya Shillings), ex-VAT unless stated  
**Policy:** Quote from this sheet for all **new** prospects. Custom flat rates (e.g. legacy Stabex/Eagle HR deals) are exceptions documented in the control plane.

---

## 1. Platform tiers (base subscription)

| Tier | Staff band | Platform base (KES/mo) | Default MRR anchor | Notes |
|------|------------|------------------------|--------------------|-------|
| **Starter** | up to 25 | 15,000 – 25,000 | **18,000** | HR & Payroll + Finance foundational; pick **2** horizontal plug-ins |
| **Growth** | 26 – 100 | 40,000 – 60,000 | **55,000** | **4** core module packs; **1** vertical pack included; multi-entity |
| **Business** | 101 – 500 | 90,000 – 120,000 | **Quote mid-band** | Full horizontal suite; multiple vertical packs |
| **Enterprise** | 500+ | from **150,000** | Custom | All modules, dedicated success, SLAs, bespoke rollout |

Source of truth in code: `app/src/lib/pricing-bands.ts`, `control-plane/src/lib/plan-packs.ts`, marketing page `PRICING_TIERS`.

---

## 2. Module add-ons (à-la-carte)

Applies when a customer exceeds their plan's included module quota or negotiates extra packs.

| Add-on type | Rate (KES/mo) | Code reference |
|-------------|---------------|----------------|
| Extra **horizontal** module | **5,000** | `ADDON_PRICING_CENTS.horizontalModuleMonthly` |
| **Vertical pack** (Fleet / Assets / HSE) | **15,000** each | `ADDON_PRICING_CENTS.verticalPackMonthly` |
| **Seat overage** (above tier band) | **500 / employee / mo** | `ADDON_PRICING_CENTS.seatOveragePerEmployeeMonthly` |
| **Payroll module** add-on (Starter/Business bands) | 15,000 – 60,000 banded | `PRICING_BANDS[].payrollAddonKes*` |
| **Generic module** add-on (Starter/Business bands) | 8,000 – 40,000 banded | `PRICING_BANDS[].moduleAddonKes*` |

**Annual prepay discount:** 10% (`ADDON_PRICING_CENTS.annualPrepayDiscountPercent`).

---

## 3. What's included per tier

Aligned with `docs/STRIDE-PACKAGING.md` and `/pricing` compare matrix.

### Starter (KES 18K/mo · up to 25 staff)
- Foundational: Core HR, Leave, Time, Payroll, Accounts, ESS, Reports, Disciplinary, Documents
- Horizontal quota: **2** plug-ins (e.g. Procurement, Legal, ATS)
- Vertical packs: add-on only
- Support: Email

### Growth (KES 55K/mo · up to 100 staff)
- Foundational: all Starter modules
- Horizontal quota: **4** plug-ins (ATS, Performance, Training, Procurement, Legal, Communications, …)
- Vertical: **1** pack included (Fleet, Assets, or HSE)
- Multi-entity, priority support + onboarding

### Enterprise (Custom · 100+ staff)
- All modules, unlimited staff band
- Dedicated success manager, custom integrations, SLAs, on-site implementation

---

## 4. HR outsourcing / BPO billing (separate from platform SaaS)

For Eagle HR-style managed payroll and end-client billing:

| Model | Formula | Example |
|-------|---------|---------|
| Per head | `headcount × unit rate` | 25 employees × KES 3,500 = **87,500/mo** |
| Flat monthly | fixed fee | KES 15,000/mo |
| Percentage markup | `% of payroll gross` | 5% × KES 1M gross = **50,000/mo** |
| Payroll pass-through | net pay + NITA + management fee | See `billing-automation.ts` golden cases |

Rate cards live on each `OutsourcingClient` in the product; golden tests in `qa-01-critical-logic.test.ts`.

---

## 5. Quoting rules for sales

1. **Start from tier band** using active employee count (or projected count at go-live).
2. **Add module line items** only for modules beyond the tier quota — use add-on rates in §2.
3. **Document exceptions** in control plane (`SubscriptionModule` overrides + notes) when deviating from this sheet.
4. **Do not default to custom flat rates** for new logos — Stabex KES 150K all-inclusive remains grandfathered until renewal repricing.
5. **Cross-check Eagle HR repricing** (RAV-138) against Growth/Enterprise bands before renewal conversations.

---

## 6. Related artefacts

| Document / file | Purpose |
|-----------------|---------|
| `docs/STRIDE-PACKAGING.md` | Entitlement buckets + negotiation layer |
| `app/src/lib/marketing-config.ts` → `PRICING_TIERS` | Public marketing copy |
| `app/src/lib/marketing-pricing-entitlements.ts` | Tier → module mapping |
| `control-plane/src/lib/addon-pricing.ts` | MRR estimate calculator |
| `control-plane/src/components/SubscriptionPricingPanel.tsx` | Per-customer live estimate |

---

## 7. Revision log

| Date | Change |
|------|--------|
| 2026-07-06 | RAV-148 — Initial standard sheet published; aligns Platform + Modules decision with code anchors |
