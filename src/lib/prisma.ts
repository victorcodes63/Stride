import { PrismaClient } from '@prisma/client';
import { isQueryTimingEnabled } from '@/lib/perf/query-timing';
import { warnOnCrossTenantRows } from '@/lib/tenant-row-guard';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

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
  client.$on('query', (event) => {
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

  if (!shouldInstallTenantRowGuard()) return base;

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, query, args }) {
          const result = await query(args);
          warnOnCrossTenantRows(result, `${model}.${operation}`);
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
