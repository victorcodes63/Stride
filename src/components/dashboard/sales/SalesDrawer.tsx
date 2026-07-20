'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type SalesDrawerProps = {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
};

const WIDTHS: Record<NonNullable<SalesDrawerProps['width']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

/**
 * Right-side drawer shell shared across Sales detail views (deals, leads,
 * contacts, quotes). Portaled, ESC-to-close, scroll-locked, with an optional
 * sticky footer for actions.
 */
export function SalesDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 'lg',
}: SalesDrawerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-[1px] animate-in fade-in"
      />
      <aside
        className={`flex h-full w-full ${WIDTHS[width]} flex-col border-l border-[var(--dash-border)] bg-[var(--dash-surface-solid)] shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border)] px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-[var(--dash-text-strong)]">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 truncate text-sm text-[var(--dash-text-muted)]">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-5 py-3">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
