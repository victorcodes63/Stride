'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import { parseFormFields } from '@/components/onboarding/DynamicForm';

type Submission = {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  data: Record<string, unknown>;
  submittedAt: string | null;
  reviewNotes: string | null;
  formTemplate: { id: string; name: string; description: string | null; fields: unknown };
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string | null } | null;
  essPortalUser: { id: string; name: string; email: string } | null;
  reviewedBy: { id: string; name: string; email: string } | null;
};

const STATUS_TONE: Record<Submission['status'], DashStatusTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function SubmissionReviewPage() {
  const params = useParams();
  const id = params?.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/forms/submissions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load submission');
      setSubmission(data as Submission);
      setNotes(typeof data.reviewNotes === 'string' ? data.reviewNotes : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  async function review(status: 'APPROVED' | 'REJECTED') {
    setBusy(status);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/forms/submissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNotes: notes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setBusy(null);
    }
  }

  const fields = submission ? parseFormFields(submission.formTemplate.fields) : [];
  const submitter = submission?.employee
    ? `${submission.employee.firstName} ${submission.employee.lastName}`
    : submission?.essPortalUser?.name ?? 'Unknown';
  const canReview = submission?.status === 'SUBMITTED';

  return (
    <DashboardPage>
      <Link
        href="/dashboard/onboarding"
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Onboarding
      </Link>
      <DashboardPageHeader title="Review submission" description="Review the employee's answers and approve or request changes." />

      {error ? (
        <div className="my-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="dashboard-surface flex items-center gap-2 p-6 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : submission ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="dashboard-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">{submission.formTemplate.name}</h2>
                <span className={dashStatusChip(STATUS_TONE[submission.status])}>{submission.status}</span>
              </div>
              {submission.formTemplate.description ? (
                <p className="mt-1 text-xs text-neutral-500">{submission.formTemplate.description}</p>
              ) : null}

              <dl className="mt-4 divide-y divide-neutral-100">
                {fields.map((field) => (
                  <div key={field.key} className="grid grid-cols-3 gap-2 py-2.5">
                    <dt className="col-span-1 text-xs font-medium text-neutral-500">{field.label}</dt>
                    <dd className="col-span-2 text-sm text-neutral-800">
                      {displayValue(submission.data?.[field.key])}
                    </dd>
                  </div>
                ))}
                {fields.length === 0 ? (
                  <p className="py-3 text-sm text-neutral-400">This form has no fields.</p>
                ) : null}
              </dl>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-1">
            <div className="dashboard-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-neutral-500">Submitted by</dt>
                  <dd className="font-medium text-neutral-800">{submitter}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Submitted at</dt>
                  <dd className="text-neutral-800">
                    {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '—'}
                  </dd>
                </div>
                {submission.reviewedBy ? (
                  <div>
                    <dt className="text-xs text-neutral-500">Reviewed by</dt>
                    <dd className="text-neutral-800">{submission.reviewedBy.name}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="dashboard-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">Review</h2>
              <textarea
                className="mt-3 min-h-[96px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Notes for the employee (optional for approve, recommended for reject)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canReview}
              />
              {canReview ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void review('APPROVED')}
                    className="btn-primary inline-flex flex-1 items-center justify-center gap-1"
                  >
                    {busy === 'APPROVED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void review('REJECTED')}
                    className="btn-secondary inline-flex flex-1 items-center justify-center gap-1 text-red-700"
                  >
                    {busy === 'REJECTED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Reject
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-neutral-500">
                  {submission.status === 'DRAFT'
                    ? 'This submission is still a draft and cannot be reviewed yet.'
                    : `Already ${submission.status.toLowerCase()}.`}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardPage>
  );
}
