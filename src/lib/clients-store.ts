// In-memory clients store for development when DATABASE_URL is not set.
// Use PostgreSQL in production.

export interface ClientRecord {
  id: string;
  name: string;
  isAnonymous: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

const clients: ClientRecord[] = [];
let nextId = 1;

export function getInMemoryClients(): ClientRecord[] {
  return [...clients].sort((a, b) => a.name.localeCompare(b.name));
}

export function getInMemoryClientById(id: string): ClientRecord | null {
  return clients.find((c) => c.id === id) ?? null;
}

/** Find a client by name (case-insensitive, trimmed). */
export function getInMemoryClientByName(name: string): ClientRecord | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return clients.find((c) => c.name.trim().toLowerCase() === n) ?? null;
}

export interface CreateClientInput {
  name: string;
  isAnonymous?: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function createInMemoryClient(input: CreateClientInput): ClientRecord {
  const id = `client-mem-${nextId++}`;
  const client: ClientRecord = {
    id,
    name: input.name.trim(),
    isAnonymous: input.isAnonymous ?? false,
    contactName: input.contactName?.trim() || null,
    contactEmail: input.contactEmail?.trim() || null,
    contactPhone: input.contactPhone?.trim() || null,
  };
  clients.push(client);
  return client;
}

function optionalTrim(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t === '' ? null : t;
}

export function updateInMemoryClient(
  id: string,
  updates: Partial<CreateClientInput>
): ClientRecord | null {
  const index = clients.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const existing = clients[index];
  const updated: ClientRecord = {
    id: existing.id,
    name: updates.name !== undefined ? updates.name.trim() : existing.name,
    isAnonymous: updates.isAnonymous ?? existing.isAnonymous,
    contactName: updates.contactName !== undefined ? optionalTrim(updates.contactName) : existing.contactName,
    contactEmail: updates.contactEmail !== undefined ? optionalTrim(updates.contactEmail) : existing.contactEmail,
    contactPhone: updates.contactPhone !== undefined ? optionalTrim(updates.contactPhone) : existing.contactPhone,
  };
  clients[index] = updated;
  return updated;
}

export function deleteInMemoryClient(id: string): boolean {
  const index = clients.findIndex((c) => c.id === id);
  if (index === -1) return false;
  clients.splice(index, 1);
  return true;
}
