import type { OverviewCoreMetrics } from '@/lib/dashboard-overview-metrics';

const CACHE_VERSION = 1;
const CACHE_KEY = `stride_overview_core_v${CACHE_VERSION}`;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedOverviewCore = {
  orgId: string;
  entityId: string;
  savedAt: number;
  data: OverviewCoreMetrics;
};

export function readOverviewCoreCache(orgId: string, entityId: string): OverviewCoreMetrics | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedOverviewCore;
    if (parsed.orgId !== orgId || parsed.entityId !== entityId) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeOverviewCoreCache(
  orgId: string,
  entityId: string,
  data: OverviewCoreMetrics,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedOverviewCore = {
      orgId,
      entityId,
      savedAt: Date.now(),
      data,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private mode errors.
  }
}
