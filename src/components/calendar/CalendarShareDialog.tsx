'use client';

import { useEffect, useMemo, useState } from 'react';
import { Share2, X } from 'lucide-react';
import AppActionButton from '@/components/ui/AppActionButton';
import AppSelect from '@/components/ui/AppSelect';

type StaffOption = { id: string; name: string; email: string };

type ShareRow = {
  id: string;
  windowStart: string;
  windowEnd: string;
  accessExpiresAt: string;
  detailLevel: string;
  message: string | null;
  owner?: StaffOption;
  viewer?: StaffOption;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

const PRESET_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'next_3_days', label: 'Next 3 days' },
  { value: 'week', label: 'Next week (7 days)' },
  { value: 'fortnight', label: 'Next fortnight (14 days)' },
  { value: 'month', label: 'Next 30 days' },
  { value: 'custom', label: 'Custom dates' },
];

function nairobiTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDateKey(key: string, amount: number) {
  const [year, month, day] = key.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return next.toISOString().slice(0, 10);
}

function windowEndForPreset(preset: string, customEnd: string) {
  const today = nairobiTodayKey();
  if (preset === 'today') return today;
  if (preset === 'next_3_days') return addDateKey(today, 2);
  if (preset === 'week') return addDateKey(today, 6);
  if (preset === 'fortnight') return addDateKey(today, 13);
  if (preset === 'month') return addDateKey(today, 29);
  return customEnd || today;
}

function formatAccessDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export default function CalendarShareDialog({ open, onClose, onChanged }: Props) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffQuery, setStaffQuery] = useState('');
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [preset, setPreset] = useState('week');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [accessExpiresAt, setAccessExpiresAt] = useState(() => windowEndForPreset('week', ''));
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [detailLevel, setDetailLevel] = useState('titles');
  const [message, setMessage] = useState('');
  const [outgoing, setOutgoing] = useState<ShareRow[]>([]);
  const [incoming, setIncoming] = useState<ShareRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestedExpiry = useMemo(
    () => windowEndForPreset(preset, windowEnd),
    [preset, windowEnd],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    Promise.all([
      fetch('/api/calendar/shares').then((response) => response.json()),
      fetch('/api/calendar/staff?all=1').then((response) => response.json()),
    ])
      .then(([sharesData, staffData]) => {
        setOutgoing(Array.isArray(sharesData.outgoing) ? sharesData.outgoing : []);
        setIncoming(Array.isArray(sharesData.incoming) ? sharesData.incoming : []);
        setStaff(Array.isArray(staffData.staff) ? staffData.staff : []);
      })
      .catch(() => setError('Could not load sharing details.'))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!expiryTouched) setAccessExpiresAt(suggestedExpiry);
  }, [suggestedExpiry, expiryTouched]);

  if (!open) return null;

  const filteredStaff = staff.filter((person) => {
    if (viewerIds.includes(person.id)) return false;
    const q = staffQuery.trim().toLowerCase();
    if (!q) return true;
    return person.name.toLowerCase().includes(q) || person.email.toLowerCase().includes(q);
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar/shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          viewerIds,
          preset,
          windowStart: preset === 'custom' ? windowStart : undefined,
          windowEnd: preset === 'custom' ? windowEnd : undefined,
          accessExpiresAt: accessExpiresAt || undefined,
          detailLevel,
          message: message.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not share calendar.');
      setViewerIds([]);
      setMessage('');
      setStaffQuery('');
      setExpiryTouched(false);
      setAccessExpiresAt(windowEndForPreset(preset, windowEnd));
      const refreshed = await fetch('/api/calendar/shares').then((res) => res.json());
      setOutgoing(Array.isArray(refreshed.outgoing) ? refreshed.outgoing : []);
      setIncoming(Array.isArray(refreshed.incoming) ? refreshed.incoming : []);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share calendar.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    const response = await fetch(`/api/calendar/shares/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || 'Could not update share.');
      return;
    }
    setOutgoing((items) => items.filter((item) => item.id !== id));
    setIncoming((items) => items.filter((item) => item.id !== id));
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-label="Share personal calendar"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-primary-900">
              <Share2 className="h-5 w-5" aria-hidden />
              Share personal calendar
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Grant view-only access for a date window. Sticky notes stay private.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-neutral-600">
            <X className="h-5 w-5" aria-hidden />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
          ) : null}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <p className="text-sm font-medium text-neutral-700">Share with</p>
              <input
                value={staffQuery}
                onChange={(event) => setStaffQuery(event.target.value)}
                placeholder="Search colleagues"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
              {viewerIds.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {viewerIds.map((id) => {
                    const person = staff.find((item) => item.id === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setViewerIds((ids) => ids.filter((viewerId) => viewerId !== id))
                        }
                        className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-800"
                      >
                        {person?.name ?? 'Selected'} ×
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-neutral-200">
                {filteredStaff.slice(0, 40).map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      setViewerIds((ids) => [...ids, person.id]);
                      setStaffQuery('');
                    }}
                    className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2.5 text-left last:border-0 hover:bg-primary-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-neutral-800">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">{person.email}</span>
                    </span>
                    <span className="text-xs font-semibold text-primary-700">Add</span>
                  </button>
                ))}
                {!filteredStaff.length ? (
                  <p className="px-3 py-3 text-sm text-neutral-500">No matching colleagues.</p>
                ) : null}
              </div>
            </div>

            <AppSelect
              value={preset}
              onChange={(value) => setPreset(value as string)}
              options={PRESET_OPTIONS}
              label="Visible dates"
              className="w-full"
            />

            {preset === 'custom' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-neutral-700">
                  From
                  <input
                    required
                    type="date"
                    value={windowStart}
                    onChange={(event) => setWindowStart(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium text-neutral-700">
                  To
                  <input
                    required
                    type="date"
                    value={windowEnd}
                    onChange={(event) => setWindowEnd(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </label>
              </div>
            ) : null}

            <label className="block text-sm font-medium text-neutral-700">
              Access until
              <input
                required
                type="date"
                min={nairobiTodayKey()}
                value={accessExpiresAt}
                onChange={(event) => {
                  setExpiryTouched(true);
                  setAccessExpiresAt(event.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
              <span className="mt-1 block text-xs font-normal text-neutral-500">
                Defaults to the end of the visible window. Extend if they should keep access longer.
              </span>
            </label>

            <AppSelect
              value={detailLevel}
              onChange={(value) => setDetailLevel(value as string)}
              options={[
                { value: 'titles', label: 'Show titles & times' },
                { value: 'busy', label: 'Busy / Focus only (hide titles)' },
              ]}
              label="What they see"
              className="w-full"
            />

            <label className="block text-sm font-medium text-neutral-700">
              Note to recipients (optional)
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. Covering interviews while I’m in client meetings"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>

            <AppActionButton
              variant="solid"
              label={saving ? 'Sharing…' : 'Share calendar'}
              type="submit"
              disabled={!viewerIds.length}
              loading={saving}
              className="w-full"
            />
          </form>

          <div className="border-t border-neutral-100 pt-4">
            <h3 className="text-sm font-semibold text-neutral-800">Active shares you gave</h3>
            {loading ? (
              <p className="mt-2 text-sm text-neutral-500">Loading…</p>
            ) : outgoing.length ? (
              <ul className="mt-2 space-y-2">
                {outgoing.map((share) => (
                  <li
                    key={share.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-neutral-800">{share.viewer?.name}</p>
                      <p className="text-neutral-500">
                        Visible {share.windowStart} → {share.windowEnd}
                        {share.detailLevel === 'busy' ? ' · busy only' : ''}
                      </p>
                      <p className="text-neutral-500">
                        Access until {formatAccessDate(share.accessExpiresAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(share.id)}
                      className="shrink-0 text-xs font-semibold text-red-700 hover:underline"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">No active outgoing shares.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Shared with you</h3>
            {incoming.length ? (
              <ul className="mt-2 space-y-2">
                {incoming.map((share) => (
                  <li
                    key={share.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-violet-950">{share.owner?.name}</p>
                      <p className="text-violet-800/80">
                        Visible {share.windowStart} → {share.windowEnd}
                      </p>
                      <p className="text-violet-800/80">
                        Access until {formatAccessDate(share.accessExpiresAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(share.id)}
                      className="shrink-0 text-xs font-semibold text-neutral-600 hover:underline"
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">Nobody has shared a calendar with you yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
