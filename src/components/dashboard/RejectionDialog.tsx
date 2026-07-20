'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const REASON_PRESETS = [
  'Does not meet minimum qualifications',
  'Insufficient relevant experience',
  'Stronger candidates available',
  'Salary expectations out of range',
  'Failed assessment / interview',
  'Position filled',
];

export function RejectionDialog({
  candidateName,
  onConfirm,
  onCancel,
}: {
  candidateName: string;
  onConfirm: (reason: string, sendEmail: boolean) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onCancel} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm rejection"
        className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl border border-neutral-200"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-neutral-100">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Reject application</h3>
              <p className="text-sm text-neutral-500">
                {candidateName ? `Reject ${candidateName}?` : 'Reject this application?'} This is recorded in the
                activity log.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-600">
              Reason <span className="text-neutral-400">(saved to the audit trail)</span>
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    reason === preset
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Add context for the record (optional)…"
              className="w-full resize-y rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700 focus:border-red-300 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <label className="flex items-center gap-2.5 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-red-600 focus:ring-red-500"
            />
            Send the templated rejection email to the candidate
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 p-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim(), sendEmail)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
          >
            Reject{sendEmail ? ' & notify' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
