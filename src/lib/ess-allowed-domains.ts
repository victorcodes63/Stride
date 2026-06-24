import { DEFAULT_STAFF_ALLOWED_DOMAIN_ENV } from '@/lib/staff-allowed-domains';

/**
 * Allowed email domains for ESS OAuth — defaults to staff domains unless overridden.
 */
export function getEssAllowedDomains(): string[] {
  const raw = process.env.ESS_ALLOWED_DOMAIN?.trim() || process.env.STAFF_ALLOWED_DOMAIN;
  return (raw || DEFAULT_STAFF_ALLOWED_DOMAIN_ENV)
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isEssAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return getEssAllowedDomains().some((domain) => normalized.endsWith(`@${domain}`));
}
