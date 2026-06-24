# Module migration checklist (RAV-67)

Per-module **tenant-safe gate** applied as each licensed module moves onto the Phase 0 core.
A module may not ship new features (or leave Phase 0) until every item below is checked for that module.

> Platform-wide schema + RLS landed in **RAV-62**. This checklist covers **route migration**, **tests**, and **sign-off**.

## When to run this

- Before marking a Linear module issue **Done** (Phases A–G).
- After adding a new Prisma model to a module.
- In CI: `npm run audit:module-tenant` (schema hard-fail; routes report-only until migration completes).

## Checklist (copy per module PR)

### 1. Schema

- [ ] Every new/changed table has `organizationId String @db.Uuid` (FK to `Organization` where appropriate).
- [ ] Migration is **additive** (see `.cursor/rules/database-migrations.mdc`).
- [ ] RLS policies added in `prisma/migrations/rls_policies.sql` (`_tenant_rw` + `_insert_bootstrap`).
- [ ] `npm run db:rls` applied on dev; `npm run test:rls` passes.

### 2. API routes

- [ ] All staff **mutations and reads** for this module use `withTenant()` from `src/lib/tenant-api.ts`.
- [ ] DB access goes through `ctx.run()` so `app.current_org` is set (RLS enforced under `stride_app`).
- [ ] Filters use `ctx.where({ … })` for defense in depth.
- [ ] Mutations call `ctx.audit({ action, entityType, entityId })`.
- [ ] RBAC: `withTenant(request, handler, { permission: 'module.action' })` where applicable.
- [ ] ESS/cron/webhook routes documented if intentionally exempt (separate auth path).

### 3. UI / server components

- [ ] Server actions and loaders resolve `currentOrgId` from session (not from client input alone).
- [ ] Module nav remains behind entitlement + `MODULE_*` flags.

### 4. Tests

- [ ] `npm run test:rls` still passes (platform gate).
- [ ] Module smoke: create row in Org A → invisible in Org B (extend `scripts/test-rls.ts` or add `scripts/test-tenant-<module>.ts`).
- [ ] `npm run audit:module-tenant` shows module at **tenant-safe** or justified exempt routes.

### 5. Sign-off

- [ ] Update `MODULE_MIGRATION_TRACKING` in `src/lib/module-migration-registry.ts` (`phase: 'tenant-safe'`).
- [ ] Linear issue notes + link to PR.

## Module registry

| Source | Purpose |
|--------|---------|
| `src/lib/module-migration-registry.ts` | Tracking + representative Prisma models |
| `src/lib/module-routes.ts` | API prefix → `ModuleKey` bindings |
| `npm run audit:module-tenant` | Automated schema + route report |

## Migration phases

| Phase | Meaning |
|-------|---------|
| `not-started` | Mock UI or no real tenant data path yet |
| `schema-ready` | Tables have `organizationId` + RLS; routes still legacy |
| `routes-partial` | Some routes use `withTenant()` |
| `tenant-safe` | All module staff API routes migrated + tests pass |

## Exemplar (copy this pattern)

```ts
// src/app/api/outsourcing/employees/route.ts
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const rows = await ctx.run((tx) =>
      tx.employee.findMany({ where: ctx.where({ active: true }) }),
    );
    return NextResponse.json(rows);
  });
}
```

## Related docs

- [`MULTI-TENANT-REFERENCE.md`](./MULTI-TENANT-REFERENCE.md) — RLS + `withOrgContext`
- [`STRIDE-MASTER-PLAN.md`](./STRIDE-MASTER-PLAN.md) §6 Phase 0.6, §9 Cursor rules
- [`CELL-PROVISIONING.md`](./CELL-PROVISIONING.md) — new org on a cell
