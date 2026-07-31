'use client';

/**
 * Sales Performance — shared TanStack Query keys and thin data hooks.
 *
 * Every Sales page uses these so cache invalidation is consistent across the
 * module (e.g. moving a deal invalidates overview + analytics + forecast).
 */

import {
  apiFetch,
  useApiMutation,
  useApiResource,
  type ApiError,
} from '@/hooks/useApiResource';
import type { UseQueryOptions } from '@tanstack/react-query';

/** Canonical query-key factory for the Sales module. */
export const salesKeys = {
  all: ['sales'] as const,
  overview: () => [...salesKeys.all, 'overview'] as const,
  analytics: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'analytics', params ?? {}] as const,
  deals: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'deals', params ?? {}] as const,
  deal: (id: string) => [...salesKeys.all, 'deal', id] as const,
  leads: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'leads', params ?? {}] as const,
  contacts: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'contacts', params ?? {}] as const,
  accounts: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'accounts', params ?? {}] as const,
  account: (id: string) => [...salesKeys.all, 'account', id] as const,
  products: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'products', params ?? {}] as const,
  quotes: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'quotes', params ?? {}] as const,
  orders: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'orders', params ?? {}] as const,
  order: (id: string) => [...salesKeys.all, 'order', id] as const,
  territories: () => [...salesKeys.all, 'territories'] as const,
  promotions: () => [...salesKeys.all, 'promotions'] as const,
  vanLoads: () => [...salesKeys.all, 'vanLoads'] as const,
  quote: (id: string) => [...salesKeys.all, 'quote', id] as const,
  tasks: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'tasks', params ?? {}] as const,
  targets: () => [...salesKeys.all, 'targets'] as const,
  attainment: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'attainment', params ?? {}] as const,
  forecast: (params?: Record<string, string | number | undefined>) =>
    [...salesKeys.all, 'forecast', params ?? {}] as const,
  commissions: () => [...salesKeys.all, 'commissions'] as const,
  reps: () => [...salesKeys.all, 'reps'] as const,
  pipelines: () => [...salesKeys.all, 'pipelines'] as const,
  assignmentRules: () => [...salesKeys.all, 'assignment-rules'] as const,
  priceBooks: () => [...salesKeys.all, 'price-books'] as const,
  quoteApprovals: () => [...salesKeys.all, 'quote-approvals'] as const,
};

/** Keys that reflect aggregate metrics — invalidate after any deal write. */
export const salesAggregateKeys = [
  salesKeys.all,
  salesKeys.overview(),
] as const;

/** GET a Sales JSON resource with caching. */
export function useSalesResource<T>(
  key: readonly unknown[],
  url: string,
  options?: Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>,
) {
  return useApiResource<T>(key, url, options);
}

/** Mutation helper that invalidates the whole Sales cache subtree by default. */
export function useSalesMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    invalidateKeys?: readonly (readonly unknown[])[];
    onSuccess?: (data: TData, variables: TVariables) => unknown;
  },
) {
  return useApiMutation<TData, TVariables>(mutationFn, {
    invalidateKeys: options?.invalidateKeys ?? [salesKeys.all],
    onSuccess: options?.onSuccess as never,
  });
}

export { apiFetch };
export type { ApiError };
