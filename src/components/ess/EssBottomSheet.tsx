'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function EssBottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="ess-glass relative mx-auto max-h-[90vh] w-full max-w-xl overflow-hidden rounded-t-[2rem] shadow-[var(--ess-shadow-float)] ess-safe-bottom"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--ess-border)] px-4 py-3">
          <h2 className="text-lg font-black text-[var(--ess-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--ess-muted)] hover:bg-[var(--ess-secondary-soft)]"
            aria-label="Close sheet"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 max-h-[calc(90vh-56px)]">{children}</div>
      </div>
    </div>
  );
}
