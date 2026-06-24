# Multi-Tenant Reference — proven patterns for Phase 0 (RAV-62)

**Why this exists:** the `platform/` codebase (Drizzle) already built and verified a working
multi-tenant core per `BUILD-BLUEPRINT.md`. We chose `hris-demo` (Prisma) as the canonical Stride
product (it has all the features), so we **port these proven patterns onto Prisma** rather than
reinvent them. RLS lives at the Postgres level, so it is **ORM-agnostic** — the SQL below transfers
unchanged; only the app-layer glue differs (Drizzle → Prisma).

> Source of truth for the patterns: `platform/src/core/db/` (`org-context.ts`,
> `migrations/0001_rls.sql`, `migrations/0002_rls_modules.sql`) and `platform/scripts/{apply-rls,test-rls}.ts`.
> Mine those files before archiving `platform/`.

## 1. The mechanism (3 parts)

**a) A request/transaction sets the current org as a Postgres session var.**
Platform's `withOrgContext` (transaction-scoped, `set_config(..., true)` = local to the txn):
```ts
// platform/src/core/db/org-context.ts (Drizzle)
await tx.execute(sql`SELECT set_config('app.current_org', ${organizationId}, true)`);
```
**Prisma equivalent:**
```ts
export async function withOrgContext<T>(orgId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${orgId}, true)`;
    return fn(tx);
  });
}
```
Every tenant-scoped query must run inside `withOrgContext`. API routes use **`withTenant()`**
(`src/lib/tenant-api.ts`) which sets org context from the staff session, exposes `ctx.run()` /
`ctx.where()` / `ctx.audit()`, and optional `can()` RBAC checks.

```ts
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const rows = await ctx.run((tx) =>
      tx.employee.findMany({ where: ctx.where({ outsourcingClientId: clientId }) }),
    );
    return NextResponse.json(rows);
  });
}
```

Mutations should call `ctx.audit()` (or `withTenantAudit()` for same-transaction audit) so
`audit_events.organization_id` is always stamped. Legacy `logAuditEvent()` resolves org from the
actor membership when routes have not migrated yet.

**b) Every tenant table carries `organizationId` and has RLS policies.**
The policy pattern (identical SQL for Prisma):
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

-- read/write only your org's rows
CREATE POLICY <table>_tenant_rw ON <table>
  FOR ALL
  USING (organization_id = current_setting('app.current_org', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- bootstrap insert: allowed when NO org context is set (provisioning a new org) or matching org
CREATE POLICY <table>_insert_bootstrap ON <table>
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR organization_id = current_setting('app.current_org', true)::uuid
  );
```
The `coalesce(..., '') = ''` bootstrap clause is the trick that lets provisioning create a brand-new
org row before any context exists, without weakening isolation for normal requests.

**c) Global (non-tenant) tables get NO RLS.**
Platform's exclusion list: `users`, `permissions`, `role_permissions`, `statutory_config`.
In Stride/Prisma the equivalents are the global identity + the **country statutory config** tables
(statutory rates are shared reference data, keyed by country + effective date — see master plan §2).

## 2. Applying to the Prisma schema (RAV-62 work)
1. Add `Organization` model + `organizationId` (uuid) FK on every tenant table.
2. Generate a Prisma migration that, in addition to columns, runs the RLS SQL above for each tenant
   table (Prisma migrations can include raw SQL). Mirror `platform`'s `0001_rls.sql` /
   `0002_rls_modules.sql` table-by-table.
3. Add the Prisma `withOrgContext` helper (above) and route all tenant queries through it.
4. Keep `users`, permissions catalogs, and `statutory_config` global (no RLS).
5. **Data migration:** create one default `Organization`, stamp existing rows with its id (the current
   single workspace becomes "org 1"). This is the existing-data path RAV-62 calls out.

## 3. Verifying isolation (the acceptance test)
Port `platform/scripts/test-rls.ts`: create Org A + Org B, set context to A, insert a row, then set
context to B and confirm the row is **not** visible / not mutable. RAV-62 exit criteria = this test
passes. Wire it as `npm run test:rls` and run it in CI.

## 4. What NOT to copy
- **Drizzle itself** — Stride stays on Prisma. Only the SQL policies + the session-var pattern port.
- Platform's thin feature modules (people/payroll/etc.) — Stride's are far more complete. Use platform
  only for the tenancy core.

---
*Once RAV-62 lands and `npm run test:rls` passes on Stride, `platform/` has served its purpose and can
be archived (`_archive/platform/`).*
</content>
