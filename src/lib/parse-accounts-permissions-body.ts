import type { GlobalAccountsPermInput } from '@/lib/set-global-accounts-access';

/** Returns undefined if body does not include accountsPermissions. */
export function parseAccountsPermissionsBody(body: Record<string, unknown>): GlobalAccountsPermInput | undefined {
  if (!('accountsPermissions' in body)) return undefined;
  const raw = body.accountsPermissions;
  if (raw === null || typeof raw !== 'object') {
    throw new Error('accountsPermissions must be an object');
  }
  const o = raw as Record<string, unknown>;
  return {
    canManageContracts: o.canManageContracts === true,
    canManageInvoices: o.canManageInvoices === true,
    canManagePayments: o.canManagePayments === true,
    canManageVendors: o.canManageVendors === true,
  };
}
