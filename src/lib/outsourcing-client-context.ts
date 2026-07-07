export const OUTSOURCING_CLIENT_STORAGE_KEY = 'stride:outsourcing:clientId';

export type OutsourcingClientOption = {
  id: string;
  name: string;
};

export function readStoredOutsourcingClientId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(OUTSOURCING_CLIENT_STORAGE_KEY);
    return value?.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function writeStoredOutsourcingClientId(clientId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!clientId?.trim()) {
      sessionStorage.removeItem(OUTSOURCING_CLIENT_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(OUTSOURCING_CLIENT_STORAGE_KEY, clientId.trim());
  } catch {
    // ignore storage failures
  }
}

/** Pick active end-client from URL, storage, or first available client. */
export function resolveOutsourcingClientId(
  clients: OutsourcingClientOption[],
  urlClientId: string | null | undefined,
): string {
  const fromUrl = urlClientId?.trim();
  if (fromUrl && clients.some((c) => c.id === fromUrl)) return fromUrl;

  const stored = readStoredOutsourcingClientId();
  if (stored && clients.some((c) => c.id === stored)) return stored;

  return clients[0]?.id ?? '';
}

export function withOutsourcingClientQuery(path: string, clientId?: string | null): string {
  if (!clientId?.trim()) return path;
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('clientId', clientId.trim());
  return `${base}?${params.toString()}`;
}
