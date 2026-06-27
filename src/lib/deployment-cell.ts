/**
 * Deployment cell classification — demo/sandbox vs customer production pooled cell.
 * ISO-01: customer cells must never fall back to NEXT_PUBLIC_ORG_NAME / SwiftFreight branding.
 */

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function parseBoolean(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}

/** Generic placeholder when a tenant has no saved company setup yet. */
export const GENERIC_ORG_PLACEHOLDER = 'Your Organisation';

/**
 * Demo/sandbox cell: sales demos, vertical showcases, internal sandbox.
 * Requires DEMO_MODE plus an explicit demo pack or public demo flag.
 */
export function isDemoSandboxCell(): boolean {
  if (!parseBoolean(trimEnv('DEMO_MODE'), false)) return false;
  return Boolean(trimEnv('DEMO_PACK') || trimEnv('NEXT_PUBLIC_DEMO_MODE'));
}

/** Paying-customer pooled cell (app.getstride.co.ke after ISO-01 env split). */
export function isCustomerProductionCell(): boolean {
  return !isDemoSandboxCell();
}

/**
 * Env-provided tenant display name — only on demo/sandbox cells or dedicated single-tenant
 * deploys with PROVISION_ORG_NAME (no DEMO_PACK).
 */
export function envTenantDisplayName(): string | null {
  if (isDemoSandboxCell()) {
    return trimEnv('NEXT_PUBLIC_ORG_NAME') ?? trimEnv('PROVISION_ORG_NAME') ?? null;
  }
  return trimEnv('PROVISION_ORG_NAME') ?? null;
}

/** Resolve workspace/org display name: DB org name wins; env only on allowed cells. */
export function resolveTenantDisplayName(organizationName?: string | null): string {
  const fromDb = organizationName?.trim();
  if (fromDb) return fromDb;
  return envTenantDisplayName() ?? GENERIC_ORG_PLACEHOLDER;
}
