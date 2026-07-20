'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Thin fetch wrapper: always credentialed, JSON in/out, throws ApiError on !ok. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

/**
 * GET a JSON resource with caching. `key` is the TanStack Query key; `url` is
 * fetched via the credentialed apiFetch helper.
 */
export function useApiResource<T>(
  key: readonly unknown[],
  url: string,
  options?: Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, ApiError>({
    queryKey: key,
    queryFn: () => apiFetch<T>(url),
    ...options,
  });
}

/**
 * Mutation helper. Provide a `mutationFn` (usually calling apiFetch) and, via
 * `invalidateKeys`, the query keys to refetch on success.
 */
export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    invalidateKeys?: readonly (readonly unknown[])[];
  } & Omit<UseMutationOptions<TData, ApiError, TVariables>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();
  const { invalidateKeys, onSuccess, ...rest } = options ?? {};
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: (...args) => {
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
      return onSuccess?.(...args);
    },
    ...rest,
  });
}
