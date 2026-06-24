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

export default function InterviewWithdrawPage() {
  const params = useParams();
  const token = params.token as string;
  const [info, setInfo] = useState<InterviewInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/interview/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'withdraw', notes: notes.trim() || undefined }),
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
      title="Withdraw from this role"
      description={info ? `${info.jobTitle} at ${info.companyName}` : undefined}
      footer={
        <>
          Changed your mind?{' '}
          <Link href={`/interview/confirm/${token}`} className="font-medium text-pub-primary hover:underline">
            Confirm attendance
          </Link>
          {' or '}
          <Link href={`/interview/reschedule/${token}`} className="font-medium text-pub-primary hover:underline">
            request reschedule
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
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-pub-ink">
                  Reason for withdrawing{' '}
                  <span className="font-normal text-pub-ink-subtle">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="e.g. I have accepted another offer or my circumstances have changed."
                  className="pub-login-input min-h-[6rem] resize-y py-2.5"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Withdraw my application'}
              </button>
            </form>
          )}
        </>
      ) : null}
    </InterviewRespondShell>
  );
}
