'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, MailCheck, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import type { OutsourcingClientJson, PayslipDnsRecord } from '@/lib/outsourcing-client';

interface PayslipDomainCardProps {
  clientId: string;
  client: OutsourcingClientJson;
  onUpdated: (client: OutsourcingClientJson) => void;
}

const inputClass =
  'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

function statusTone(status: string | null): { label: string; className: string } {
  switch (status) {
    case 'verified':
      return { label: 'Verified', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'pending':
    case 'not_started':
      return { label: 'Pending DNS', className: 'text-amber-800 bg-amber-50 border-amber-200' };
    case 'partially_verified':
    case 'partially_failed':
      return { label: 'Partially verified', className: 'text-amber-800 bg-amber-50 border-amber-200' };
    case 'temporary_failure':
      return { label: 'Temporary failure', className: 'text-amber-800 bg-amber-50 border-amber-200' };
    case 'failed':
      return { label: 'Failed', className: 'text-red-700 bg-red-50 border-red-200' };
    default:
      return { label: status ?? 'Unknown', className: 'text-neutral-700 bg-neutral-100 border-neutral-200' };
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-1 text-neutral-500 hover:bg-neutral-50"
      aria-label="Copy value"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function DnsRecordsTable({ records }: { records: PayslipDnsRecord[] }) {
  if (records.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 font-semibold">Name / Host</th>
            <th className="px-3 py-2 font-semibold">Value</th>
            <th className="px-3 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {records.map((r, i) => {
            const tone = statusTone(r.status ?? null);
            return (
              <tr key={`${r.type}-${r.name}-${i}`} className="align-top">
                <td className="px-3 py-2 font-mono text-neutral-700">
                  {r.type}
                  {r.priority != null ? <span className="text-neutral-400"> (prio {r.priority})</span> : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono break-all text-neutral-800">{r.name}</span>
                    <CopyButton value={r.name} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono break-all text-neutral-800">{r.value}</span>
                    <CopyButton value={r.value} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone.className}`}>
                    {tone.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PayslipDomainCard({ clientId, client, onUpdated }: PayslipDomainCardProps) {
  const hasDomain = client.payslipSenderMode === 'custom_domain' && !!client.payslipSenderDomain;
  const verified = client.payslipDomainStatus === 'verified';

  const [domain, setDomain] = useState('');
  const [localPart, setLocalPart] = useState('payroll');
  const [busy, setBusy] = useState<null | 'add' | 'verify' | 'refresh' | 'remove'>(null);
  const [error, setError] = useState<string | null>(null);

  const call = async (
    action: 'add' | 'verify' | 'refresh' | 'remove',
    method: string,
    body?: Record<string, unknown>,
  ) => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/payslip-domain`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      onUpdated(data as OutsourcingClientJson);
      if (action === 'add') setDomain('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  };

  const effectiveSender =
    hasDomain && verified
      ? `${client.payslipSenderLocalPart || 'payroll'}@${client.payslipSenderDomain}`
      : `${(client.payslipFromName || client.name) ?? 'Company'} · platform address`;

  return (
    <div className="dashboard-surface shadow-sm p-4 sm:p-6">
      <h2 className="text-base font-semibold text-primary-900 mb-1 flex items-center gap-2">
        <MailCheck className="w-5 h-5 text-primary-600" />
        Payslip sending domain
      </h2>
      <p className="text-sm text-neutral-600 mb-4">
        Verify {client.name}&apos;s own domain so payslips are sent from their identity (e.g.{' '}
        <span className="font-mono">payroll@company.co.ke</span>) with proper SPF/DKIM. Until a domain is
        verified, payslips send from the Stride platform address stamped with the client&apos;s name and reply-to.
      </p>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <p className="text-neutral-600">
          Current payslip sender:{' '}
          <span className="font-medium text-neutral-900 font-mono">{effectiveSender}</span>
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {!hasDomain ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Sending domain</span>
              <input
                className={inputClass}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="payroll.company.co.ke"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Mailbox (local part)</span>
              <input
                className={inputClass}
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                placeholder="payroll"
              />
            </label>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={busy !== null || !domain.trim()}
              onClick={() => void call('add', 'POST', { domain: domain.trim(), localPart: localPart.trim() })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60 sm:w-auto"
            >
              {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Add &amp; get DNS records
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-neutral-900">
                {client.payslipSenderLocalPart || 'payroll'}@{client.payslipSenderDomain}
              </span>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone(client.payslipDomainStatus).className}`}
              >
                {statusTone(client.payslipDomainStatus).label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void call('verify', 'PATCH')}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify DNS
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void call('refresh', 'GET')}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                {busy === 'refresh' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void call('remove', 'DELETE')}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove
              </button>
            </div>
          </div>

          {verified ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Domain verified. Payslips for {client.name} now send from{' '}
              <span className="font-mono">
                {client.payslipSenderLocalPart || 'payroll'}@{client.payslipSenderDomain}
              </span>
              .
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-600">
                Add these records at {client.name}&apos;s DNS provider, then click <strong>Verify DNS</strong>.
                Propagation can take a few minutes to a few hours.
              </p>
              <DnsRecordsTable records={client.payslipDomainRecords ?? []} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
