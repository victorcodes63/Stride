# Cell provisioning (RAV-66)

How the **control plane** provisions tenants on **regional cells** vs **dedicated instances**.

## Topology

| Mode | Where | DB | Control plane link |
|------|--------|-----|-------------------|
| **Pooled (shared)** | Regional cell e.g. `app.getstride.co.ke` | One Neon DB, many `Organization` rows + RLS | `Customer.cellId`, `tenantOrgId`, `tenantOrgSlug` |
| **Dedicated** | Client Vercel project | Client Neon project | `Customer.deploymentUrl` only |

## Pooled flow (minutes)

1. Create **Customer** on control plane (`deploymentType: shared`, `country: KE|UG|TZ`).
2. Seed subscription / plan modules.
3. **Provision org on cell** — customer detail → *Provision on pooled cell*, or:

```bash
curl -X POST "$CONTROL_PLANE_URL/api/v1/provision" \
  -H "Authorization: Bearer $CONTROL_PLANE_INSTANCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "acme",
    "legalName": "Acme Ltd",
    "country": "KE",
    "adminEmail": "hr@acme.co.ke"
  }'
```

4. Control plane calls `POST {cell}/api/internal/provision/org` (Bearer `STRIDE_CELL_PROVISION_KEY`).
5. Cell creates `Organization`, admin `User`, `OrganizationMembership`, audit row.
6. **Sync entitlements** — webhook includes `organizationId`; entitlements stored in `Organization.settings.entitlements`.
7. Admin logs in on the cell URL and selects the new org in the switcher.

## Dedicated flow

Follow [`CLIENT-PROVISIONING.md`](./CLIENT-PROVISIONING.md): separate Vercel + Neon, set `CONTROL_PLANE_CUSTOMER_SLUG` on the instance, sync entitlements to deployment-level cache.

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `STRIDE_CELL_PROVISION_KEY` | Control plane + each cell | Auth for `POST /api/internal/provision/org` |
| `CONTROL_PLANE_WEBHOOK_SECRET` | Both | Signed entitlement webhooks |
| `CONTROL_PLANE_URL` | Dedicated instances (optional on pooled) | Pull entitlements |

## Regional routing

`DeploymentCell` registry maps `KE` → `ke-primary` (`app.getstride.co.ke`). UG/TZ cells are stubbed until those deployments exist.

Seed cells: `npx tsx scripts/seed-deployment-cells.ts` (control plane).

## Exit criteria (RAV-66)

- [x] Cell registry + country → cell routing
- [x] Provision API on cell
- [x] Control plane orchestration + customer linkage
- [x] Per-org entitlement storage on pooled cell
- [x] Dedicated path documented (`CLIENT-PROVISIONING.md`)
