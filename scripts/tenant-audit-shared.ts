/** Shared path prefixes exempt from tenant-wrapper / prisma-scope CI gates (RAV-251). */
export const ROUTE_EXEMPT_PREFIXES = [
  '/api/auth',
  '/api/config',
  '/api/webhooks',
  '/api/internal',
  '/api/cron',
  '/api/ess/auth',
  '/api/ess/manifest',
  '/api/marketing',
  '/api/contact',
  '/api/test',
  '/api/upload',
  '/api/interview/respond',
  '/api/insights',
];

export function isExemptApiPath(apiPath: string): boolean {
  return ROUTE_EXEMPT_PREFIXES.some(
    (prefix) => apiPath === prefix || apiPath.startsWith(`${prefix}/`),
  );
}

export function usesTenantWrapper(source: string): boolean {
  return (
    /\bwithTenant\s*\(/.test(source) ||
    /\bwithTenantAudit\s*\(/.test(source) ||
    /\bwithFleetTenant\s*\(/.test(source) ||
    /\bwithAccountsTenant\s*\(/.test(source) ||
    /\bwithEssTenant\s*\(/.test(source) ||
    /\bwithAssessmentAccessToken\s*\(/.test(source) ||
    /\bwithQuoteAcceptContext\s*\(/.test(source) ||
    /\bwithOrderStatusContext\s*\(/.test(source) ||
    (/\bwithOrgContext\s*\(/.test(source) && /\brequireStaffUser\b/.test(source))
  );
}

export function usesOrgScopedAuth(source: string): boolean {
  return (
    usesTenantWrapper(source) ||
    /\brequireStaffUser\b/.test(source) ||
    /\brequireAdminOrganization\b/.test(source) ||
    /\brequireAdminActor\b/.test(source)
  );
}

export function usesDirectPrismaClient(source: string): boolean {
  return /\bprisma\./.test(source);
}

export function usesTenantTransaction(source: string): boolean {
  return /\bctx\.run\s*\(/.test(source) || /\bwithOrgContext\s*\(/.test(source);
}
