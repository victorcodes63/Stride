/**
 * Resend sending-domain management for per-client payslip white-labeling (Option C).
 * Server-only — imports the Resend SDK. Used by the payslip-domain API routes.
 */
import 'server-only';
import { Resend } from 'resend';
import type { PayslipDnsRecord } from '@/lib/outsourcing-client';

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export type SendingDomainResult =
  | {
      ok: true;
      id: string;
      name: string;
      status: string;
      records: PayslipDnsRecord[];
    }
  | { ok: false; error: string; reason: 'not_configured' | 'api_error' };

type RawRecord = {
  record?: string;
  name?: string;
  value?: string;
  type?: string;
  ttl?: string;
  status?: string;
  priority?: number;
};

function mapRecords(records: unknown): PayslipDnsRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .filter((r): r is RawRecord => !!r && typeof r === 'object')
    .map((r) => ({
      record: typeof r.record === 'string' ? r.record : String(r.type ?? ''),
      name: String(r.name ?? ''),
      type: String(r.type ?? ''),
      value: String(r.value ?? ''),
      ttl: typeof r.ttl === 'string' ? r.ttl : 'Auto',
      status: typeof r.status === 'string' ? r.status : undefined,
      priority: typeof r.priority === 'number' ? r.priority : undefined,
    }))
    .filter((r) => r.name && r.value && r.type);
}

const NOT_CONFIGURED: SendingDomainResult = {
  ok: false,
  reason: 'not_configured',
  error: 'Email sending is not configured on this deployment (missing RESEND_API_KEY).',
};

/** Register a new sending domain in Resend and return the DNS records the client must add. */
export async function createSendingDomain(name: string): Promise<SendingDomainResult> {
  const resend = getResendClient();
  if (!resend) return NOT_CONFIGURED;
  try {
    const { data, error } = await resend.domains.create({ name });
    if (error || !data) {
      return { ok: false, reason: 'api_error', error: error?.message || 'Failed to create sending domain.' };
    }
    return {
      ok: true,
      id: data.id,
      name: data.name,
      status: data.status,
      records: mapRecords(data.records),
    };
  } catch (e) {
    return { ok: false, reason: 'api_error', error: e instanceof Error ? e.message : 'Failed to create sending domain.' };
  }
}

/** Fetch the current status + DNS records for a sending domain. */
export async function getSendingDomain(id: string): Promise<SendingDomainResult> {
  const resend = getResendClient();
  if (!resend) return NOT_CONFIGURED;
  try {
    const { data, error } = await resend.domains.get(id);
    if (error || !data) {
      return { ok: false, reason: 'api_error', error: error?.message || 'Failed to load sending domain.' };
    }
    return {
      ok: true,
      id: data.id,
      name: data.name,
      status: data.status,
      records: mapRecords(data.records),
    };
  } catch (e) {
    return { ok: false, reason: 'api_error', error: e instanceof Error ? e.message : 'Failed to load sending domain.' };
  }
}

/** Trigger DNS re-verification, then return the refreshed status + records. */
export async function verifySendingDomain(id: string): Promise<SendingDomainResult> {
  const resend = getResendClient();
  if (!resend) return NOT_CONFIGURED;
  try {
    const { error } = await resend.domains.verify(id);
    if (error) {
      return { ok: false, reason: 'api_error', error: error.message || 'Failed to trigger verification.' };
    }
    // verify() only kicks off the check; re-fetch to get the latest status + records.
    return getSendingDomain(id);
  } catch (e) {
    return { ok: false, reason: 'api_error', error: e instanceof Error ? e.message : 'Failed to verify sending domain.' };
  }
}

/** Remove a sending domain from Resend. Best-effort — resolves even if already gone. */
export async function deleteSendingDomain(id: string): Promise<{ ok: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) return { ok: true };
  try {
    await resend.domains.remove(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to remove sending domain.' };
  }
}
