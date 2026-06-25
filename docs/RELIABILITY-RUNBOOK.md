# Stride — Reliability & Support Runbook (G5 / RAV-100)

## Support tiers

| Tier | Channel |
|------|---------|
| Starter | Email, 2 business days |
| Growth | Priority email + onboarding |
| Enterprise | Dedicated success + SLA |

## Sev-1 examples

Payroll cannot approve; auth down; suspected data leak → mitigate first, customer comms < 1h.

## Entitlement sync

1. Confirm SubscriptionModule rows in control plane.
2. Sync now → check failure panel.
3. Staff re-login on cell.

## Restore drill (annual)

1. Restore Neon branch to isolated environment.
2. Smoke: login, employees, one payslip PDF.
3. Log RTO in `docs/STRIDE-CUTOVER-RUNBOOK.md`.

## Fleet ops

See `docs/FLEET-REGISTRY.md`. Requires `MODULE_FLEET` + subscription row.

## Releases

Preview → smoke → promote. Rollback via Vercel previous deployment.
