/**
 * Staff password + OAuth login may only accept emails whose domain is listed in
 * `STAFF_ALLOWED_DOMAIN` (comma-separated). When unset, allow generic demo seeds.
 * In demo mode, always merges `DEMO_EMAIL_DOMAIN` (and heritage subdomain) so local
 * shell exports of STAFF_ALLOWED_DOMAIN cannot block demo logins.
 */
export const DEFAULT_STAFF_ALLOWED_DOMAIN_ENV = 'example.com';

function parseDomainList(raw: string): string[] {
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function isDemoModeEnabled(): boolean {
  return (
    process.env.DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  );
}

function getDemoStaffDomains(): string[] {
  if (!isDemoModeEnabled()) return [];
  const base =
    process.env.DEMO_EMAIL_DOMAIN?.trim().replace(/^["']|["']$/g, '') ||
    'demo.getstride.co.ke';
  return [base, `heritage.${base}`];
}

function expandParentDomains(domains: string[]): string[] {
  const set = new Set(domains);
  for (const d of domains) {
    const parts = d.split('.');
    // e.g. nyati.imara.co.ke or nyati.demo.imara.co.ke → also allow imara.co.ke
    if (parts.length > 3 && parts.slice(-2).join('.') === 'co.ke') {
      set.add(parts.slice(-3).join('.'));
    }
  }
  return [...set];
}

export function getStaffAllowedDomains(): string[] {
  const raw = process.env.STAFF_ALLOWED_DOMAIN || DEFAULT_STAFF_ALLOWED_DOMAIN_ENV;
  const merged = [...parseDomainList(raw), ...getDemoStaffDomains()];
  return expandParentDomains([...new Set(merged)]);
}

/** True when the email domain equals or is a subdomain of an allowed domain. */
export function isStaffEmailDomainAllowed(
  email: string,
  allowedDomains: string[] = getStaffAllowedDomains(),
): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0) return false;
  const emailDomain = normalized.slice(at + 1);
  return allowedDomains.some(
    (allowed) => emailDomain === allowed || emailDomain.endsWith(`.${allowed}`),
  );
}
