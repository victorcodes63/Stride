'use client';

import { useEffect, useState } from 'react';
import { History, Loader2, ArrowRight } from 'lucide-react';
import type { ApplicationActivityItem } from '@/app/api/applications/[id]/activity/route';
import { APPLICATION_STATUS_META, isApplicationStatus } from '@/lib/ats-status';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusChip({ value }: { value: string | null }) {
  if (!value) return <span className="text-neutral-400">—</span>;
  const meta = isApplicationStatus(value) ? APPLICATION_STATUS_META[value] : null;
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${meta?.badge ?? 'bg-neutral-100 text-neutral-600'}`}>
      {meta?.label ?? value}
    </span>
  );
}

export function ApplicationActivityPanel({
  applicationId,
  refreshKey = 0,
}: {
  applicationId: string;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<ApplicationActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/applications/${applicationId}/activity`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items)) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, refreshKey]);

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-neutral-500">
        <History className="h-4 w-4" />
        Activity
      </h3>
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
          No status changes recorded yet.
        </p>
      ) : (
        <ol className="space-y-3 border-l border-neutral-200 pl-4">
          {items.map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-neutral-300 ring-2 ring-white" />
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <StatusChip value={item.from} />
                <ArrowRight className="h-3 w-3 text-neutral-400" />
                <StatusChip value={item.to} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {item.actorName || item.actorEmail || 'System'} · {relativeTime(item.createdAt)}
              </p>
              {item.reason && (
                <p className="mt-1 rounded-md bg-neutral-50 px-2 py-1 text-xs text-neutral-600">
                  “{item.reason}”
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
