/**
 * Per-client payslip sender resolution (pure, client-safe — no server-only imports).
 *
 * Phased white-label delivery:
 * - Option B (default): send from the platform domain, but stamped with the client's
 *   From name and Reply-To. Works instantly, no DNS onboarding.
 * - Option C: once a client verifies their own sending domain, payslips send from
 *   `localPart@domain`. Falls back to Option B until the domain reaches `verified`.
 */

export const PAYSLIP_DOMAIN_STATUSES = [
  'not_started',
  'pending',
  'verified',
  'failed',
  'temporary_failure',
  'partially_verified',
  'partially_failed',
] as const;
export type PayslipDomainStatus = (typeof PAYSLIP_DOMAIN_STATUSES)[number];

export const DEFAULT_PAYSLIP_LOCAL_PART = 'payroll';

/** Subset of OutsourcingClient fields needed to resolve a payslip sender. */
export interface PayslipSenderClient {
  name?: string | null;
  payslipFromName?: string | null;
  payslipReplyTo?: string | null;
  payslipSenderMode?: string | null;
  payslipSenderLocalPart?: string | null;
  payslipSenderDomain?: string | null;
  payslipDomainStatus?: string | null;
}

export interface PlatformSenderDefaults {
  fromEmail: string;
  fromName: string;
  replyTo: string;
}

export interface ResolvedPayslipSender {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  /** True when sending from the client's own verified domain (Option C). */
  usingCustomDomain: boolean;
}

/** RFC-ish sanity check for a sending domain (no scheme, no path, at least one dot). */
export function isValidSendingDomain(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v.length > 253) return false;
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(v);
}

/** Normalize the local part of the sender address (before the @). */
export function normalizeSenderLocalPart(value: string | null | undefined): string {
  const cleaned = (value ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return cleaned || DEFAULT_PAYSLIP_LOCAL_PART;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Resolve the effective payslip sender for a client, given the platform defaults.
 * Always returns a usable sender — the platform domain is the ultimate fallback.
 */
export function resolvePayslipSender(
  client: PayslipSenderClient | null | undefined,
  platform: PlatformSenderDefaults,
): ResolvedPayslipSender {
  const fromName =
    client?.payslipFromName?.trim() || client?.name?.trim() || platform.fromName;

  const replyToCandidate = client?.payslipReplyTo?.trim();
  const replyTo = replyToCandidate && isEmail(replyToCandidate) ? replyToCandidate : platform.replyTo;

  const domain = client?.payslipSenderDomain?.trim().toLowerCase();
  const canUseCustomDomain =
    client?.payslipSenderMode === 'custom_domain' &&
    client?.payslipDomainStatus === 'verified' &&
    !!domain &&
    isValidSendingDomain(domain);

  if (canUseCustomDomain) {
    const local = normalizeSenderLocalPart(client?.payslipSenderLocalPart);
    return {
      fromName,
      fromEmail: `${local}@${domain}`,
      replyTo,
      usingCustomDomain: true,
    };
  }

  return {
    fromName,
    fromEmail: platform.fromEmail,
    replyTo,
    usingCustomDomain: false,
  };
}
