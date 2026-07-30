'use client';

import { useState } from 'react';
import { Bell, CalendarDays, ListTodo, StickyNote, X } from 'lucide-react';
import AppActionButton from '@/components/ui/AppActionButton';
import AppSelect from '@/components/ui/AppSelect';
import { parseDateTimeAsNairobi } from '@/lib/timezone';

export type QuickAddKind = 'event' | 'note' | 'reminder' | 'task';
export type QuickAddScope = 'personal' | 'company';

type Props = {
  open: boolean;
  scope: QuickAddScope;
  /** Nairobi date key YYYY-MM-DD */
  dateKey: string;
  /** Optional hour 0-23 for timed create */
  hour?: number | null;
  /** Optional minute 0-59 (snapped) */
  minute?: number | null;
  onClose: () => void;
  onCreated: (result: { kind: QuickAddKind; id: string; title: string; startsAt?: string }) => void;
};

const PERSONAL_KINDS: Array<{ id: QuickAddKind; label: string; Icon: typeof CalendarDays }> = [
  { id: 'event', label: 'Event', Icon: CalendarDays },
  { id: 'note', label: 'Note', Icon: StickyNote },
  { id: 'reminder', label: 'Reminder', Icon: Bell },
  { id: 'task', label: 'Task', Icon: ListTodo },
];

const COMPANY_KINDS: Array<{ id: QuickAddKind; label: string; Icon: typeof CalendarDays }> = [
  { id: 'event', label: 'Event', Icon: CalendarDays },
  { id: 'note', label: 'Note', Icon: StickyNote },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function CalendarQuickAdd({
  open,
  scope,
  dateKey,
  hour = 9,
  minute = 0,
  onClose,
  onCreated,
}: Props) {
  const kinds = scope === 'company' ? COMPANY_KINDS : PERSONAL_KINDS;
  const startHour = hour ?? 9;
  const startMinute = minute ?? 0;
  const endTotal = startHour * 60 + startMinute + 60;
  const [kind, setKind] = useState<QuickAddKind>(kinds[0].id);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [time, setTime] = useState(`${pad(startHour)}:${pad(startMinute)}`);
  const [endTime, setEndTime] = useState(
    `${pad(Math.floor(endTotal / 60) % 24)}:${pad(endTotal % 60)}`,
  );
  const [recurrence, setRecurrence] = useState('none');
  const [reminderMinutes, setReminderMinutes] = useState('15');
  const [linkToTask, setLinkToTask] = useState(false);
  const [priority, setPriority] = useState('none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const selectKind = (next: QuickAddKind) => {
    setKind(next);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Enter a title.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      if (kind === 'task') {
        const dueLocal = `${dateKey}T${time}`;
        const dueAt = parseDateTimeAsNairobi(dueLocal);
        const response = await fetch('/api/staff/tasks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: trimmed,
            description: notes.trim() || undefined,
            assignToMe: true,
            dueAt: dueAt.toISOString(),
            priority,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not create task.');
        onCreated({ kind: 'task', id: data.id, title: trimmed, startsAt: dueAt.toISOString() });
        onClose();
        return;
      }

      const startLocal = `${dateKey}T${time}`;
      const endLocal = `${dateKey}T${endTime}`;
      const startsAt = parseDateTimeAsNairobi(startLocal);
      let endsAt = parseDateTimeAsNairobi(endLocal);
      if (kind === 'reminder') endsAt = startsAt;
      if (kind === 'note') {
        // API normalizes to day bounds; send any valid pair
        endsAt = new Date(startsAt.getTime() + 60_000);
      }

      const payload: Record<string, unknown> = {
        scope,
        kind: kind === 'event' ? 'event' : kind,
        title: trimmed,
        notes: notes.trim() || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        allDay: kind === 'note',
        recurrence: kind === 'note' ? 'none' : recurrence,
        reminderMinutes:
          kind === 'event'
            ? reminderMinutes
              ? Number(reminderMinutes)
              : null
            : kind === 'reminder'
              ? 0
              : null,
        linkToTask: kind === 'reminder' ? linkToTask : false,
        priority: scope === 'personal' && kind !== 'note' ? priority : undefined,
        eventType: scope === 'company' && kind === 'event' ? 'meeting' : undefined,
        isFocusBlock: false,
        participantIds: [],
      };

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save.');
      onCreated({
        kind,
        id: data.event.id,
        title: trimmed,
        startsAt: data.event.startsAt,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-label="Quick add to calendar"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-primary-900">Quick add</h2>
            <p className="text-sm text-neutral-500">
              {dateKey}
              {kind !== 'note' ? ` · ${time}` : ' · all day'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Item type">
          {kinds.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectKind(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                kind === id
                  ? 'border-primary-300 bg-primary-50 text-primary-900'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

        <label className="block text-sm font-medium text-neutral-700">
          Title
          <input
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            placeholder={
              kind === 'note'
                ? 'Sticky note…'
                : kind === 'reminder'
                  ? 'Remind me to…'
                  : kind === 'task'
                    ? 'Task title…'
                    : 'Event title…'
            }
            autoFocus
          />
        </label>

        {kind !== 'note' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-neutral-700">
              {kind === 'event' ? 'Starts' : 'Time'}
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            {kind === 'event' ? (
              <label className="block text-sm font-medium text-neutral-700">
                Ends
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
            ) : (
              <div />
            )}
          </div>
        ) : null}

        {kind === 'event' || kind === 'reminder' ? (
          <AppSelect
            value={recurrence}
            onChange={(value) => setRecurrence(value as string)}
            options={[
              { value: 'none', label: 'Does not repeat' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            label="Repeat"
            className="w-full"
          />
        ) : null}

        {kind === 'event' ? (
          <AppSelect
            value={reminderMinutes}
            onChange={(value) => setReminderMinutes(value as string)}
            options={[
              { value: '', label: 'No email/inbox reminder' },
              { value: '0', label: 'At start' },
              { value: '15', label: '15 minutes before' },
              { value: '60', label: '1 hour before' },
              { value: '1440', label: '1 day before' },
            ]}
            label="Remind me"
            className="w-full"
          />
        ) : null}

        {kind === 'reminder' || kind === 'task' || (kind === 'event' && scope === 'personal') ? (
          <AppSelect
            value={priority}
            onChange={(value) => setPriority(value as string)}
            options={[
              { value: 'none', label: 'No priority' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            label="Priority"
            className="w-full"
          />
        ) : null}

        {kind === 'reminder' ? (
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={linkToTask}
              onChange={(e) => setLinkToTask(e.target.checked)}
            />
            Also add to My tasks
          </label>
        ) : null}

        <label className="block text-sm font-medium text-neutral-700">
          Notes <span className="font-normal text-neutral-400">(optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <AppActionButton variant="outline" label="Cancel" onClick={onClose} disabled={saving} />
          <AppActionButton
            variant="solid"
            label={saving ? 'Saving…' : 'Save'}
            type="submit"
            loading={saving}
          />
        </div>
      </form>
    </div>
  );
}
