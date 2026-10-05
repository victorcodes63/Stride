import type { OverviewCoreMetrics } from '@/lib/dashboard-overview-metrics';

const CACHE_VERSION = 2;
const CACHE_KEY = `stride_overview_core_v${CACHE_VERSION}`;
const CACHE_TTL_MS = 5 * 60 * 1000;
export const OVERVIEW_CORE_CACHE_EVENT = 'stride:overview-core-updated';

type CachedOverviewCore = {
  orgId: string;
  entityId: string;
  savedAt: number;
  data: OverviewCoreMetrics;
  /** Precomputed Action Center badge count — avoids a second metrics round-trip in the nav. */
  attentionCount: number;
};

export type OverviewCoreCacheSnapshot = {
  data: OverviewCoreMetrics;
  attentionCount: number;
};

function readRawCache(): CachedOverviewCore | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedOverviewCore;
  } catch {
    return null;
  }
}

export function readOverviewCoreCache(orgId: string, entityId: string): OverviewCoreMetrics | null {
  const parsed = readRawCache();
  if (!parsed) return null;
  if (parsed.orgId !== orgId || parsed.entityId !== entityId) return null;
  if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
  return parsed.data;
}

export function readOverviewAttentionCount(orgId: string, entityId: string): number | null {
  const parsed = readRawCache();
  if (!parsed) return null;
  if (parsed.orgId !== orgId || parsed.entityId !== entityId) return null;
  if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
  return typeof parsed.attentionCount === 'number' ? parsed.attentionCount : null;
}

export function writeOverviewCoreCache(
  orgId: string,
  entityId: string,
  data: OverviewCoreMetrics,
  attentionCount = 0,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedOverviewCore = {
      orgId,
      entityId,
      savedAt: Date.now(),
      data,
      attentionCount: Math.max(0, attentionCount),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    window.dispatchEvent(
      new CustomEvent(OVERVIEW_CORE_CACHE_EVENT, {
        detail: { orgId, entityId, attentionCount: payload.attentionCount },
      }),
    );
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function subscribeOverviewCoreCache(
  listener: (detail: { orgId: string; entityId: string; attentionCount: number }) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ orgId: string; entityId: string; attentionCount: number }>)
      .detail;
    if (!detail) return;
    listener(detail);
  };
  window.addEventListener(OVERVIEW_CORE_CACHE_EVENT, handler);
  return () => window.removeEventListener(OVERVIEW_CORE_CACHE_EVENT, handler);
}
