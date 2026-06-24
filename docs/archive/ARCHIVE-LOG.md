# Archive Log

Conservative cleanup, 23 June 2026. **Nothing deleted** — everything here is preserved and
reversible via git. These docs are superseded by `docs/STRIDE-MASTER-PLAN.md`.

## Moved on 23 June 2026 (this pass)

| File | Why archived | Replaced by |
|------|--------------|-------------|
| `PRODUCT-MASTER-PLAN.md` | Phases 0–9 merged into the canonical plan | `STRIDE-MASTER-PLAN.md` |
| `PRODUCT-MASTER-PLAN-uploaded.md` | Working copy that lived outside the repo; consolidated here | `STRIDE-MASTER-PLAN.md` |
| `module-roadmap.md` | Phases A–F merged into the canonical plan | `STRIDE-MASTER-PLAN.md` §6 |
| `BUILD-BLUEPRINT.md` | **Wrong architecture** — describes a multi-tenant Drizzle/RLS model. The product is dedicated-deployment on Prisma. Kept for history only; do NOT follow. | `STRIDE-MASTER-PLAN.md` §2 |
| `B2B-SALES-REFERENCE.md` / `.html` | Old "Backbone HR" branding | Rebrand to Stride before reuse (Phase G2) |
| `Backbone-HR-B2B-Sales-Reference.pdf` | Old "Backbone HR" branding | Regenerate as Stride (Phase G2) |

## Already in archive (prior cleanup — left as-is)

`APPLICATION_FLOW_AND_REQUIREMENTS`, `ATS_*`, `AUTH`, `DATABASE_SETUP`, `DEPLOY-CHECKLIST`,
`EMAIL_SETUP*`, `JOBS_AND_APPLICATIONS_ACTION_PLAN`, `MOBILE_RESPONSIVENESS_*`, `PRE_PUSH_CHECKLIST`,
`PRODUCTION_ENV_CHECKLIST`, `RECRUITMENT_TENANCY`, `SETUP_GUIDE`, `SYSTEM_FUNCTIONALITY`.

## Name history (for grep-and-replace)

Product was: **Backbone HR** → **Msingi / Imara / TBD** → **Stride** (final).
Remaining live references to old names to rebrand in Phase G2:
`DEMO-GUIDE-CARGO-LOGISTICS.md` (mentions "backbone").

## To restore anything

```bash
git mv docs/archive/<file> docs/<file>
```
Or `git log --follow docs/archive/<file>` for full history.
</content>
