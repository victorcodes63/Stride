import { AsyncLocalStorage } from 'node:async_hooks';
import {
  SLOW_QUERY_THRESHOLD_MS,
  type RouteTimingAggregate,
  type SlowQueryAggregate,
} from '@/lib/perf/query-timing';
import {
  getQueryTimingRoute,
  registerSlowQueryCollector,
  setQueryTimingRoute,
  type SlowQueryEvent,
} from '@/lib/perf/query-timing-hooks';

type QueryTimingContext = {
  route: string;
};

type SlowQueryEntry = SlowQueryEvent & {
  timestamp: number;
};

const contextStore = new AsyncLocalStorage<QueryTimingContext>();
const slowQueries: SlowQueryEntry[] = [];
const queryAggregates = new Map<string, SlowQueryAggregate>();
const routeTimings = new Map<string, Omit<RouteTimingAggregate, 'avgMs'>>();

function aggregateKey(route: string, query: string): string {
  return `${route}\0${query}`;
}

export function bindQueryTimingRoute(route: string): void {
  setQueryTimingRoute(route);
  contextStore.enterWith({ route });
}

export function getCurrentQueryRoute(): string {
  return contextStore.getStore()?.route ?? getQueryTimingRoute();
}

export function recordSlowQuery(entry: SlowQueryEvent): void {
  if (entry.durationMs < SLOW_QUERY_THRESHOLD_MS) return;

  slowQueries.push({ ...entry, timestamp: Date.now() });

  const key = aggregateKey(entry.route, entry.query);
  const existing = queryAggregates.get(key);
  if (existing) {
    existing.count += 1;
    existing.totalMs += entry.durationMs;
    existing.maxMs = Math.max(existing.maxMs, entry.durationMs);
  } else {
    queryAggregates.set(key, {
      route: entry.route,
      query: entry.query,
      maxMs: entry.durationMs,
      count: 1,
      totalMs: entry.durationMs,
    });
  }

  const routeStats = routeTimings.get(entry.route) ?? {
    route: entry.route,
    totalMs: 0,
    count: 0,
    maxMs: 0,
    slowQueryCount: 0,
  };
  routeStats.totalMs += entry.durationMs;
  routeStats.count += 1;
  routeStats.maxMs = Math.max(routeStats.maxMs, entry.durationMs);
  routeStats.slowQueryCount += 1;
  routeTimings.set(entry.route, routeStats);

  console.warn(
    `[slow-query] ${entry.durationMs}ms route=${entry.route} ${entry.query.replace(/\s+/g, ' ').slice(0, 180)}`,
  );
}

registerSlowQueryCollector(recordSlowQuery);

export function getSlowQueryReport() {
  const rankedQueries = [...queryAggregates.values()]
    .sort((a, b) => b.maxMs - a.maxMs || b.totalMs - a.totalMs)
    .slice(0, 50);

  const rankedRoutes = [...routeTimings.values()]
    .map((stats) => ({
      ...stats,
      avgMs: stats.count > 0 ? Math.round((stats.totalMs / stats.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.maxMs - a.maxMs || b.totalMs - a.totalMs)
    .slice(0, 30);

  return {
    thresholdMs: SLOW_QUERY_THRESHOLD_MS,
    generatedAt: new Date().toISOString(),
    slowQueryEventCount: slowQueries.length,
    rankedQueries,
    rankedRoutes,
  };
}

export function resetSlowQueryStats(): void {
  slowQueries.length = 0;
  queryAggregates.clear();
  routeTimings.clear();
}
