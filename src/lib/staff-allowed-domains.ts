/**
 * Staff password + OAuth login may only accept emails whose domain is listed in
 * `STAFF_ALLOWED_DOMAIN` (comma-separated). When unset, allow generic demo seeds.
 */
export const DEFAULT_STAFF_ALLOWED_DOMAIN_ENV = 'example.com';

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
  const raw = (process.env.STAFF_ALLOWED_DOMAIN || DEFAULT_STAFF_ALLOWED_DOMAIN_ENV)
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return expandParentDomains(raw);
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
