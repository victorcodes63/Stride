'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { PlatformRouteLoading } from '@/components/platform/PlatformRouteLoading';

type GrievanceDetail = {
  id: string;
  grievanceNumber: string;
  status: string;
  subject: string;
  description: string;
  category: string;
  investigationNotes: string | null;
  resolution: string | null;
  submittedAt: string;
  against: { firstName: string; lastName: string } | null;
  documents: Array<{ id: string; title: string; fileName: string }>;
};

export default function EssGrievanceDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<GrievanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/ess/grievances/${params.id}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Not found');
        setData(body);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Not found'));
  }, [params.id]);

  if (error) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-red-600">{error}</p>
        <Link href="/ess/grievances" className="text-primary-700 underline">Back</Link>
      </div>
    );
  }

  if (!data) return <PlatformRouteLoading />;

  return (
    <div className="space-y-4 pb-8">
      <EssPageHeader title={data.grievanceNumber} subtitle={data.subject} backHref="/ess/grievances" />
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Status</span>
          <EssStatusPill status={data.status} />
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">Category</p>
          <p>{data.category.replaceAll('_', ' ')}</p>
        </div>
        {data.against ? (
          <div>
            <p className="text-xs font-medium text-zinc-500">Against</p>
            <p>{data.against.firstName} {data.against.lastName}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium text-zinc-500">Description</p>
          <p className="whitespace-pre-wrap text-zinc-700">{data.description}</p>
        </div>
        {data.investigationNotes ? (
          <div>
            <p className="text-xs font-medium text-zinc-500">Investigation update</p>
            <p className="whitespace-pre-wrap text-zinc-700">{data.investigationNotes}</p>
          </div>
        ) : null}
        {data.resolution ? (
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-800">Resolution</p>
            <p className="whitespace-pre-wrap text-emerald-900">{data.resolution}</p>
          </div>
        ) : null}
        {data.documents.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">Attachments</p>
            <ul className="space-y-1">
              {data.documents.map((doc) => (
                <li key={doc.id}>
                  <span className="text-primary-700">{doc.title}</span>
                  <span className="text-xs text-zinc-500"> ({doc.fileName})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-zinc-400">Submitted {new Date(data.submittedAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
