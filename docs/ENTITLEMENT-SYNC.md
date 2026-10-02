# Entitlement sync contract

Canonical contract between **Stride Control Plane** (`control-plane/`) and **dedicated Stride instances**.

Governing spec: [`docs/business-engineering-alignment.md`](../../docs/business-engineering-alignment.md)

## Formula

```
effectiveModule = entitled ∧ envLicensed ∧ adminEnabled ∧ accountActive
```

| Factor | Source |
|--------|--------|
| `entitled` | Control plane subscription (`modules` map) |
| `envLicensed` | `MODULE_*` env vars on instance |
| `adminEnabled` | Company Setup `moduleAdminFlags` (cookie `hris_module_prefs`) |
| `accountActive` | `accountStatus` ∉ `{ suspended, churned }` |

Vertical engines (`fleet`, `assets`, `hse`) also require `verticalEnginesAllowed: true` (false on `starter` unless add-on).

Plan ids are unchanged by the per-employee repricing: planId `starter` is the plan sold publicly as
**Essentials** (see `docs/PRICING-SHEET.md`). The app also accepts `essentials` as a `DEPLOYMENT_TIER` alias.

## API

### Control plane

```
GET /api/v1/entitlements?slug={customerSlug}
GET /api/v1/entitlements?deploymentUrl={productionUrl}
GET /api/customers/{slug}/entitlements
```

Auth: `Authorization: Bearer {CONTROL_PLANE_INSTANCE_API_KEY}`

### Response shape

```json
{
  "slug": "acme",
  "accountStatus": "active",
  "planId": "growth",
  "seatLimit": 100,
  "periodEnd": "2026-07-18T00:00:00.000Z",
  "modules": { "core": true, "accounts": true, "fleet": true, "procurement": false },
  "features": { "multi_entity": true, "seat_limit": 100 },
  "buckets": {
    "foundational": ["core", "accounts", "payroll"],
    "horizontal": ["ats", "training"],
    "vertical": ["fleet"]
  },
  "horizontalQuota": 4,
  "verticalEnginesAllowed": true
}
```

## Instance configuration (Stride)

```env
CONTROL_PLANE_URL=http://localhost:3001
CONTROL_PLANE_CUSTOMER_SLUG=acme
CONTROL_PLANE_INSTANCE_API_KEY=...
```

When unset, instances fall back to env-only licensing (legacy dedicated deployments).

## Sync behaviour

| Trigger | Action |
|---------|--------|
| `GET /api/dashboard/bootstrap` | Load cache; refresh if stale (>15 min) or missing |
| Cron (optional) | `GET /api/cron/entitlements-sync` |
| Webhook push | `POST /api/webhooks/entitlements` (HMAC `X-Stride-Webhook-Signature`) |
| Manual (control plane) | Customer detail → **Sync now** |

### Cache

- **Storage:** `SystemSetting` key `deployment_entitlements`
- **Middleware cookie:** `hris_entitlements` (HttpOnly, 8h, set on bootstrap)
- **Stale TTL:** 15 minutes

### Fallback

If control plane is unreachable:

1. Use last cached entitlements if present
2. Otherwise env `MODULE_*` + `DEPLOYMENT_TIER` only

## Module buckets

| Bucket | Keys | Essentials (`starter`) | Growth |
|--------|------|---------|--------|
| Foundational | `core`, `accounts`, HR satellites | Always on | Always on |
| Horizontal | `procurement`, `legal`, `ats`, … | Max 2 active | Max 4 active |
| Vertical | `fleet`, `assets`, `hse` | Blocked | Add-on / ops pack |

Finance (`accounts`) is foundational — always entitled on every plan.

## Consumers

- `Stride/src/lib/modules.ts` → `resolveEffectiveModules()`
- `Stride/src/middleware.ts` → path → module enforcement
- `Stride/src/lib/dashboard-module-domains.ts` → domain switcher
- `Stride/src/app/api/dashboard/bootstrap/route.ts` → sync + cookies

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `MODULE_DISABLED` | 403 | Module not in effective set |
| `MODULE_QUOTA_EXCEEDED` | 403 | Horizontal plug-in quota exceeded (future admin UI) |

## Changelog

- **2026-06-18** — Initial contract (RAV-12 / RAV-13 / alignment blueprint)
