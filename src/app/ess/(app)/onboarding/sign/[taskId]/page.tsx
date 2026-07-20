'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Download, ExternalLink, Loader2, PenLine } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { toast } from '@/components/ui/toast';
import { SignaturePad } from '@/components/onboarding/SignaturePad';
import {
  EssAlert,
  EssCard,
  EssLoadingState,
  essPrimaryButtonClass,
  essSecondaryButtonClass,
} from '@/components/ess/EssUi';

type SignResponse = {
  task: { id: string; title: string; description: string | null; status: string };
  workflow: { templateName: string | null };
  signature: {
    id: string;
    documentTitle: string;
    documentPath: string | null;
    status: 'PENDING' | 'SIGNED' | 'DECLINED' | 'VOIDED';
    signerName: string | null;
    signedDocumentPath: string | null;
    declineReason: string | null;
    signedAt: string | null;
  };
};

export default function EssOnboardingSignPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.taskId as string;

  const [data, setData] = useState<SignResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'sign' | 'decline' | null>(null);

  const [signerName, setSignerName] = useState('');
  const [drawnSignature, setDrawnSignature] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    if (!taskId) return;
    setError(null);
    const res = await fetch(`/api/ess/onboarding/sign/${taskId}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setData(null);
      setError(body.error || 'Signature task not found.');
      return;
    }
    setData(body as SignResponse);
    if (body.signature?.signerName) setSignerName(body.signature.signerName);
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  async function sign() {
    if (!signerName.trim()) {
      toast.error('Enter your full name.');
      return;
    }
    if (!agree) {
      toast.error('You must agree before signing.');
      return;
    }
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before signing.');
      return;
    }
    setBusy('sign');
    setError(null);
    try {
      const res = await fetch(`/api/ess/onboarding/sign/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signatureDataUrl: drawnSignature ?? undefined,
          agree: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not sign the document.');
      toast.success('Document signed.');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not sign the document.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    if (!declineReason.trim()) {
      toast.error('Please provide a reason.');
      return;
    }
    setBusy('decline');
    setError(null);
    try {
      const res = await fetch(`/api/ess/onboarding/sign/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decline: true, declineReason: declineReason.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not decline.');
      toast.success('Document declined.');
      router.push('/ess/onboarding');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not decline.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <EssPageHeader title="Sign document" subtitle="Loading…" backHref="/ess/onboarding" />
        <EssLoadingState label="Loading document…" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <EssPageHeader title="Sign document" subtitle="Not found" backHref="/ess/onboarding" />
        <EssAlert tone="danger">{error || 'Signature task not found.'}</EssAlert>
      </div>
    );
  }

  const { signature } = data;
  const done = signature.status === 'SIGNED';
  const closed = signature.status === 'VOIDED';

  return (
    <div className="space-y-4">
      <EssPageHeader
        title={signature.documentTitle}
        subtitle={data.workflow.templateName ?? data.task.title}
        backHref="/ess/onboarding"
      />

      {error ? <EssAlert tone="danger">{error}</EssAlert> : null}

      {data.task.description ? (
        <EssCard>
          <p className="text-sm leading-6 text-[var(--ess-muted)]">{data.task.description}</p>
        </EssCard>
      ) : null}

      {signature.documentPath ? (
        <EssCard>
          <a
            href={signature.documentPath}
            target="_blank"
            rel="noreferrer"
            className={`${essSecondaryButtonClass} inline-flex w-full items-center justify-center gap-2`}
          >
            <ExternalLink className="h-4 w-4" />
            Read the document
          </a>
        </EssCard>
      ) : null}

      {done ? (
        <>
          <EssAlert tone="success">
            Signed{signature.signedAt ? ` on ${new Date(signature.signedAt).toLocaleString()}` : ''}.
          </EssAlert>
          {signature.signedDocumentPath ? (
            <a
              href={signature.signedDocumentPath}
              target="_blank"
              rel="noreferrer"
              className={`${essPrimaryButtonClass} inline-flex w-full items-center justify-center gap-2`}
            >
              <Download className="h-4 w-4" />
              Download signed PDF
            </a>
          ) : null}
        </>
      ) : closed ? (
        <EssAlert tone="warning">This signature request was voided by HR.</EssAlert>
      ) : (
        <>
          {signature.status === 'DECLINED' ? (
            <EssAlert tone="warning">
              You declined this document{signature.declineReason ? `: ${signature.declineReason}` : ''}. You can still
              sign it below.
            </EssAlert>
          ) : null}

          <EssCard className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[var(--ess-text)]">Full legal name</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-2 text-sm text-[var(--ess-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-[var(--ess-text)]">Signature</p>
              <SignaturePad
                surface="ess"
                typedName={signerName}
                onTypedNameChange={setSignerName}
                onDrawChange={setDrawnSignature}
                disabled={busy !== null}
              />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span className="text-[var(--ess-text)]">
                I have read and agree to <span className="font-semibold">{signature.documentTitle}</span>, and I
                consent to signing it electronically.
              </span>
            </label>

            <button
              type="button"
              disabled={busy !== null || !agree || !signerName.trim()}
              onClick={() => void sign()}
              className={`${essPrimaryButtonClass} inline-flex w-full items-center justify-center gap-2 disabled:opacity-50`}
            >
              {busy === 'sign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
              Sign document
            </button>
          </EssCard>

          <EssCard className="space-y-3">
            {!showDecline ? (
              <button
                type="button"
                onClick={() => setShowDecline(true)}
                className="text-sm font-semibold text-red-600"
              >
                Decline to sign
              </button>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-[var(--ess-text)]">Reason for declining</span>
                  <textarea
                    className="min-h-[80px] w-full rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-2 text-sm text-[var(--ess-text)]"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Let HR know why you can't sign"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setShowDecline(false)}
                    className={`${essSecondaryButtonClass} flex-1`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || !declineReason.trim()}
                    onClick={() => void decline()}
                    className={`${essSecondaryButtonClass} flex-1 text-red-700 disabled:opacity-50`}
                  >
                    {busy === 'decline' ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Confirm decline'}
                  </button>
                </div>
              </>
            )}
          </EssCard>
        </>
      )}

      {done ? (
        <button
          type="button"
          onClick={() => router.push('/ess/onboarding')}
          className={`${essSecondaryButtonClass} inline-flex w-full items-center justify-center gap-2`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Back to onboarding
        </button>
      ) : null}
    </div>
  );
}
