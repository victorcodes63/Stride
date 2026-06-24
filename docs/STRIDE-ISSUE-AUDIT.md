# Stride — Linear Issue Audit (24 June 2026)

Full audit of the Linear issues against the **real `app/` code** (not the inherited master-plan
snapshot). Verdict per issue: **OK** (accurate) · **CORRECTED** (issue updated) · **VERIFY** (re-check
against code before building).

## Headline finding
The master plan §3 "current state" was inherited from older docs and **under-states reality** — the
app has progressed. Several issues described "build from scratch" work that is already partly/largely
done. Risk if unaddressed: Cursor rebuilds existing features. Fix = the re-baseline issue **RAV-111**,
done before estimating any phase.

## Verified module status (pages / APIs / Prisma models)
| Module | Pages | APIs | Models | Reality vs plan |
|--------|------|------|--------|-----------------|
| Performance | 1 | 0 | 0 | **Mock** — plan correct (A2/RAV-69 OK) |
| M-Pesa disbursement | — | 0 | 0 | **Not built** — plan correct (A1/RAV-68 OK) |
| Accounts statements | 1 | 1 | — | Exists, not pure placeholder → **CORRECTED** (RAV-74) |
| Procurement | 4 | 3 | 2 | **Substantially built** — plan wrong → **CORRECTED** (RAV-79) |
| Projects | 3 | 0 | 0 | UI shells, no backend → **CORRECTED** (RAV-84) |
| Legal | 2 | 0 | — | Pages exist → **VERIFY** (RAV-76) |
| HSE | 1 | 1 | 0 | Minimal/mock — plan ~correct (RAV-92 OK) |
| Assets | 1 | 3 | — | Built — plan correct |
| Fleet | 8 | 14 | — | Heavily built — plan correct |
| Training | 1 | 1 | 3 | Backend exists — plan understated |
| Documents | 0 | 9 | — | API-only, no dashboard page → **VERIFY** |
| Facilities | 0 | 0 | — | Not built — plan correct (RAV-88) |
| Marketing site | real | — | config | **Live + Stride-branded** — plan wrong → **CORRECTED** (RAV-110) |

## Phase-by-phase verdict
- **Phase 00 (cutover RAV-101–107):** OK — reflects real workspace after the rename.
- **Phase 0 (RAV-62–67):** OK — and now strengthened with the `platform/` tenancy reference (RAV-62).
- **Phase A (RAV-68–73):** A1/A2/A3/A4 OK. Added **A0 re-baseline (RAV-111)**, **A7 design-system
  (RAV-108)**, **A8 brand migration (RAV-109)**, **A9 marketing audit (RAV-110, corrected)**.
- **Phase B (RAV-74–78):** B1 CORRECTED (statements exist). B2–B5 VERIFY (finance is mature; check M-Pesa recon/billing depth before treating as new).
- **Phase C (RAV-79–83):** CORRECTED — procurement is largely built. Re-baseline the whole phase to "verify/complete," not "build."
- **Phase D (RAV-84–87):** CORRECTED — projects UI exists; needs models + APIs only.
- **Phase E (RAV-88–92):** Facilities/board OK (not built). HSE minimal. Fleet polish — fleet is already deep, verify gaps.
- **Phase F (RAV-93–96):** OK — vertical packs genuinely not built (marketing-config marks them coming_soon).
- **Phase G (RAV-97–100):** OK — launch hardening.

## The three go-to-market gaps (added 24 Jun)
1. **A7 / RAV-108 — design-system unification.** Three unaligned token systems (teal `#0D9488`,
   blue `#0088ff`, hardcoded `#1D2460`). Standardize on the **marketing-site coral/orange Stride
   brand** (`#ff6118`). Extract shared Button/Card primitives. *Demo-visible — high priority.*
2. **A8 / RAV-109 — finish in-app brand migration.** Running app + demo data still say **Imara**
   (`@imara.co.ke`); "Backbone HR" in sales docs. Marketing surface is already Stride; the dashboard/
   ESS/demo are not. *Demo-visible.*
3. **A9 / RAV-110 — marketing audit (corrected).** Site already exists; scope is honesty badges,
   pricing↔entitlement mapping, demo CTA wiring, brand consistency — not a rebuild.

## Is it "ready to go to market without hiccups"?
**Not yet — but the blockers are now tracked.** The market-facing risks are not missing features
(the feature surface is strong); they are: (a) **UI inconsistency** (A7), (b) **half-finished brand
migration** in-app (A8), (c) **demo still shows mock performance + Imara data** (A2 + A8 + A6), and
(d) a **stale plan** that could send Cursor to rebuild existing work (A0/RAV-111). Close A0, A2, A6,
A7, A8, A9 and the Demo-ready milestone is genuinely demo-clean and on-brand.

---
*Living doc — update as RAV-111 re-walks each module against `app/`.*
</content>
