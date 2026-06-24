'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getJurisdictionPolicy } from '@/lib/east-africa-hr-policy';

type ActionRow = {
  id: string;
  type: string;
  description: string;
  actionDate: string;
  employeeAcknowledged: boolean;
  employeeResponse: string | null;
  performedBy: { name: string };
};

type CaseDetail = {
  id: string;
  caseNumber: string;
  subject: string;
  description: string;
  type: string;
  severity: string;
  status: string;
  laborJurisdiction: string;
  incidentDate: string;
  showCauseResponseDueAt: string | null;
  hearingAt: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  actions: ActionRow[];
  documents: Array<{ id: string; title: string; fileName: string; uploadedAt: string }>;
};

function label(s: string) {
  return s.replaceAll('_', ' ');
}

export default function EssDisciplinaryCasePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});

  async function load() {
    setError(null);
    const res = await fetch(`/api/ess/disciplinary/cases/${params.id}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error || 'Could not load case');
      setData(null);
      return;
    }
    setData(body as CaseDetail);
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function acknowledge(actionId: string) {
    const employeeResponse = responseDrafts[actionId]?.trim() || undefined;
    const res = await fetch(`/api/ess/disciplinary/cases/${params.id}/actions/${actionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeAcknowledged: true, employeeResponse }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || 'Update failed');
      return;
    }
    await load();
  }

  if (error && !data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/ess/disciplinary" className="text-sm text-primary-700 underline">
          Back to list
        </Link>
      </div>
    );
  }

  if (!data) return <p className="text-sm text-neutral-500">Loading...</p>;

  const policy = getJurisdictionPolicy(data.laborJurisdiction);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/ess/disciplinary" className="text-primary-700 hover:underline">
          ← My disciplinary cases
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-primary-900">
          {data.caseNumber} — {data.subject}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {label(data.type)} · {label(data.severity)} · {label(data.status)}
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <p className="font-semibold text-primary-900">Summary</p>
        <p className="mt-2 whitespace-pre-wrap text-neutral-800">{data.description}</p>
        <dl className="mt-3 grid gap-1 text-xs text-neutral-600">
          <div>
            Incident date: {new Date(data.incidentDate).toLocaleDateString()}
          </div>
          <div>Labour framework: {policy.label}</div>
          {data.showCauseResponseDueAt ? (
            <div className="font-medium text-amber-800">
              Show-cause response due: {new Date(data.showCauseResponseDueAt).toLocaleString()}
            </div>
          ) : null}
          {data.hearingAt ? (
            <div className="font-medium text-primary-800">
              Hearing scheduled: {new Date(data.hearingAt).toLocaleString()}
            </div>
          ) : null}
          {data.resolvedAt && data.resolution ? (
            <div className="mt-2 rounded bg-neutral-50 p-2">
              <span className="font-semibold text-neutral-800">Outcome: </span>
              {data.resolution}
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-semibold text-primary-900">Steps & acknowledgments</p>
        <p className="mt-1 text-xs text-neutral-500">
          Acknowledge receipt of formal steps where your employer requires a signed or electronic record.
        </p>
        <div className="mt-3 space-y-4">
          {data.actions.map((action) => (
            <div key={action.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
              <p className="text-sm font-semibold">
                {new Date(action.actionDate).toLocaleDateString()} — {label(action.type)}
              </p>
              <p className="mt-1 text-sm text-neutral-800">{action.description}</p>
              <p className="mt-1 text-xs text-neutral-500">Recorded by {action.performedBy.name}</p>
              <p className="mt-2 text-xs">
                Acknowledged:{' '}
                <span className={action.employeeAcknowledged ? 'text-green-700' : 'text-amber-700'}>
                  {action.employeeAcknowledged ? 'Yes' : 'Pending'}
                </span>
              </p>
              {!action.employeeAcknowledged ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                    placeholder="Optional response or comments (kept on file)"
                    value={responseDrafts[action.id] ?? action.employeeResponse ?? ''}
                    onChange={(e) => setResponseDrafts((s) => ({ ...s, [action.id]: e.target.value }))}
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={() => void acknowledge(action.id)}
                    className="rounded bg-primary-900 px-3 py-1.5 text-sm text-white"
                  >
                    Acknowledge receipt
                  </button>
                </div>
              ) : action.employeeResponse ? (
                <p className="mt-2 text-xs text-neutral-600">Your response: {action.employeeResponse}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-sm font-semibold text-primary-900">Documents shared with you</p>
        {data.documents.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.documents.map((doc) => (
              <li key={doc.id}>
                <a
                  className="text-sm text-primary-700 hover:underline"
                  href={`/api/ess/disciplinary/cases/${data.id}/documents/${doc.id}`}
                >
                  {doc.title} ({doc.fileName})
                </a>
                <span className="ml-2 text-xs text-neutral-400">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-xs text-neutral-600">
        <p className="font-semibold text-neutral-800">Your rights in brief ({policy.label})</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {policy.fairProcessBullets.slice(0, 4).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
