'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, Download, Loader2, RefreshCw } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';

type SignatureRequest = {
  id: string;
  documentTitle: string;
  documentPath: string | null;
  status: 'PENDING' | 'SIGNED' | 'DECLINED' | 'VOIDED';
  signerName: string | null;
  signatureImagePath: string | null;
  signedDocumentPath: string | null;
  declineReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  signedAt: string | null;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string | null } | null;
  essPortalUser: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string; email: string } | null;
  task: { id: string; title: string; status: string; workflowId: string } | null;
};

const STATUS_TONE: Record<SignatureRequest['status'], DashStatusTone> = {
  PENDING: 'warning',
  SIGNED: 'success',
  DECLINED: 'danger',
  VOIDED: 'neutral',
};

export default function SignatureDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [sig, setSig] = useState<SignatureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'void' | 'resend' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/signatures/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load signature request');
      setSig(data as SignatureRequest);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  async function act(action: 'void' | 'resend') {
    if (action === 'void' && !confirm('Void this signature request? The employee will no longer be able to sign it.')) {
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/signatures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  const signer = sig?.employee
    ? `${sig.employee.firstName} ${sig.employee.lastName}`
    : sig?.essPortalUser?.name ?? sig?.signerName ?? '—';

  return (
    <DashboardPage>
      <Link
        href="/dashboard/onboarding"
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Onboarding
      </Link>
      <DashboardPageHeader title="Signature request" description="Track e-signature status, audit trail, and the signed document." />

      {error ? (
        <div className="my-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="dashboard-surface flex items-center gap-2 p-6 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : sig ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="dashboard-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">{sig.documentTitle}</h2>
                <span className={dashStatusChip(STATUS_TONE[sig.status])}>{sig.status}</span>
              </div>
              {sig.documentPath ? (
                <a
                  href={sig.documentPath}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
                >
                  View source document
                </a>
              ) : null}

              {sig.declineReason ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <span className="font-medium">Decline reason:</span> {sig.declineReason}
                </div>
              ) : null}

              {sig.signedDocumentPath ? (
                <a
                  href={sig.signedDocumentPath}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary mt-4 inline-flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download signed PDF
                </a>
              ) : null}

              {sig.signatureImagePath ? (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-medium text-neutral-500">Captured signature</p>
                  <img
                    src={sig.signatureImagePath}
                    alt="Signature"
                    className="max-h-28 rounded-lg border border-neutral-200 bg-white p-2"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-1">
            <div className="dashboard-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">Audit trail</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-neutral-500">Signer</dt>
                  <dd className="font-medium text-neutral-800">{signer}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Signed at</dt>
                  <dd className="text-neutral-800">{sig.signedAt ? new Date(sig.signedAt).toLocaleString() : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">IP address</dt>
                  <dd className="text-neutral-800">{sig.ipAddress ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">User agent</dt>
                  <dd className="break-words text-xs text-neutral-600">{sig.userAgent ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Created</dt>
                  <dd className="text-neutral-800">{new Date(sig.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            {sig.status !== 'SIGNED' ? (
              <div className="dashboard-surface p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-neutral-900">Manage</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {sig.status !== 'VOIDED' ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void act('void')}
                      className="btn-secondary inline-flex items-center justify-center gap-1 text-red-700"
                    >
                      {busy === 'void' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      Void request
                    </button>
                  ) : null}
                  {sig.status === 'DECLINED' || sig.status === 'VOIDED' ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void act('resend')}
                      className="btn-secondary inline-flex items-center justify-center gap-1"
                    >
                      {busy === 'resend' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Resend (reset to pending)
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </DashboardPage>
  );
}
