'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { InterviewRespondShell } from '@/components/public/InterviewRespondShell';

type InterviewInfo = {
  valid: boolean;
  jobTitle: string;
  companyName: string;
  dateStr: string;
  timeStr: string;
  status: string;
};

export default function InterviewConfirmPage() {
  const params = useParams();
  const token = params.token as string;
  const [info, setInfo] = useState<InterviewInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/interview/respond?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid !== false && !data.error) {
          setInfo(data);
        } else {
          setError(data.error || 'Invalid or expired link.');
        }
      })
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/interview/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'confirm' }),
      });
      const data = await res.json();
      if (data.success) {
        setDone({ success: true, message: data.message });
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyResponded = info?.status && info.status !== 'pending';

  return (
    <InterviewRespondShell
      loading={loading}
      error={error}
      done={done}
      title="Confirm your attendance"
      description={info ? `${info.jobTitle} at ${info.companyName}` : undefined}
      footer={
        <>
          Need to reschedule?{' '}
          <Link href={`/interview/reschedule/${token}`} className="font-medium text-pub-primary hover:underline">
            Request reschedule
          </Link>
          {' · '}
          <Link href={`/interview/withdraw/${token}`} className="font-medium text-red-600 hover:underline">
            Withdraw from role
          </Link>
        </>
      }
    >
      {info ? (
        <>
          <div className="rounded-lg border border-pub-border bg-pub-surface-muted p-4 text-sm text-pub-ink-muted">
            <p>
              <strong className="text-pub-ink">Date:</strong> {info.dateStr}
            </p>
            <p className="mt-1">
              <strong className="text-pub-ink">Time:</strong> {info.timeStr}
            </p>
          </div>

          {alreadyResponded ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You have already responded to this invite.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="pub-btn-primary mt-4 w-full disabled:opacity-60"
            >
              {submitting ? 'Confirming…' : "Confirm I'll attend"}
            </button>
          )}
        </>
      ) : null}
    </InterviewRespondShell>
  );
}
