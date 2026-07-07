import { getActiveOrganizationId } from '@/lib/tenant-context-store';

type RowWithOrg = { organizationId?: string | null };

function collectRows(value: unknown, out: RowWithOrg[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectRows(item, out);
    return;
  }
  if (typeof value !== 'object') return;
  const row = value as RowWithOrg & Record<string, unknown>;
  if ('organizationId' in row) out.push(row);
  for (const nested of Object.values(row)) {
    if (nested && typeof nested === 'object') collectRows(nested, out);
  }
}

export function warnOnCrossTenantRows(result: unknown, label = 'query'): void {
  if (process.env.NODE_ENV === 'production' && process.env.TENANT_ROW_GUARD !== '1') return;

  const expected = getActiveOrganizationId();
  if (!expected) return;

  const rows: RowWithOrg[] = [];
  collectRows(result, rows);
  for (const row of rows) {
    const orgId = row.organizationId;
    if (orgId && orgId !== expected) {
      const message = `[TENANT_LEAK] ${label}: row organizationId ${orgId} !== active ${expected}`;
      console.error(message);
      if (process.env.TENANT_LEAK_STRICT === '1') {
        throw new Error(message);
      }
    }
  }
}
