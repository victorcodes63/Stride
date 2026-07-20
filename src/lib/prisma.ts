import { Prisma, PrismaClient } from '@prisma/client';
import { isQueryTimingEnabled } from '@/lib/perf/query-timing';
import { warnOnCrossTenantRows } from '@/lib/tenant-row-guard';
import { getActiveOrganizationId } from '@/lib/tenant-context-store';

/** PrismaClient variant that exposes the `query` event for `$on(...)`. */
type PrismaClientWithQueryEvents = PrismaClient<Prisma.PrismaClientOptions, 'query'>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** Write operations whose top-level payload should receive an auto-injected organizationId. */
const ORG_INJECT_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

/** Model names that actually have an `organizationId` scalar (derived from the Prisma schema). */
const ORG_SCOPED_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'organizationId'))
    .map((model) => model.name),
);

/**
 * Fill `organizationId` on create payloads from the active tenant context (RAV-62) when the
 * caller omitted it. Only applies to models that have the column and only when an org context
 * is active (i.e. inside withOrgContext). RLS `WITH CHECK` remains the backstop: a stale/wrong
 * org fails loudly rather than leaking across tenants. Top-level payloads only — nested relation
 * creates must still set organizationId explicitly.
 */
function injectOrganizationId(payload: unknown, organizationId: string): unknown {
  if (Array.isArray(payload)) {
    return payload.map((row) => injectOrganizationId(row, organizationId));
  }
  if (payload && typeof payload === 'object') {
    const row = payload as Record<string, unknown>;
    if (row.organizationId == null) row.organizationId = organizationId;
  }
  return payload;
}

function applyOrgInjection(model: string | undefined, operation: string, args: unknown): void {
  if (!model || !ORG_INJECT_OPERATIONS.has(operation) || !ORG_SCOPED_MODELS.has(model)) return;
  const organizationId = getActiveOrganizationId();
  if (!organizationId) return;

  const a = args as Record<string, unknown>;
  if (operation === 'upsert') {
    if (a.create != null) a.create = injectOrganizationId(a.create, organizationId);
    return;
  }
  if (a.data != null) a.data = injectOrganizationId(a.data, organizationId);
}

function shouldInstallTenantRowGuard(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.TENANT_ROW_GUARD === '1';
}

function prismaLogConfig():
  | ('query' | 'error' | 'warn')[]
  | ({ emit: 'event'; level: 'query' } | 'error' | 'warn')[] {
  if (isQueryTimingEnabled()) {
    return [{ emit: 'event', level: 'query' }, 'error', 'warn'];
  }
  if (process.env.NODE_ENV === 'development') {
    return ['query', 'error', 'warn'];
  }
  return ['error'];
}

function attachSlowQueryListener(client: PrismaClient): void {
  if (typeof window !== 'undefined' || !isQueryTimingEnabled()) return;
  const { getQueryTimingRoute, notifySlowQuery } =
    require('@/lib/perf/query-timing-hooks') as typeof import('@/lib/perf/query-timing-hooks');
  (client as PrismaClientWithQueryEvents).$on('query', (event) => {
    if (event.duration < 100) return;
    notifySlowQuery({
      route: getQueryTimingRoute(),
      durationMs: event.duration,
      query: event.query,
      params: event.params,
    });
  });
}

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: prismaLogConfig(),
  });
  attachSlowQueryListener(base);

  const warnOnCrossTenant = shouldInstallTenantRowGuard();

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, query, args }) {
          applyOrgInjection(model, operation, args);
          const result = await query(args);
          if (warnOnCrossTenant) warnOnCrossTenantRows(result, `${model}.${operation}`);
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
