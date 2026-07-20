'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type DrawerWidth = 'sm' | 'md' | 'lg';

const WIDTH_CLASS: Record<DrawerWidth, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DashboardDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  width?: DrawerWidth;
  children: ReactNode;
  footer?: ReactNode;
  /** Rendered in the header, aligned right of the title (e.g. status chip / actions). */
  headerAside?: ReactNode;
  dismissible?: boolean;
  className?: string;
};

/**
 * Right-anchored slide-over panel: portal + focus-trap + scroll-lock + Escape.
 * Used for record detail views (asset detail, incident investigation, etc.).
 */
export function DashboardDrawer({
  open,
  onClose,
  title,
  description,
  eyebrow,
  icon,
  width = 'md',
  children,
  footer,
  headerAside,
  dismissible = true,
  className,
}: DashboardDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  const requestClose = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => setVisible(true));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    const focusRaf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(FOCUSABLE);
      (focusable ?? panel).focus();
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(focusRaf);
      previouslyFocused.current?.focus?.();
    };
  }, [open, requestClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close panel"
        onClick={requestClose}
        className={`dash-modal-backdrop absolute inset-0 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        tabIndex={-1}
      />
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          tabIndex={-1}
          className={`dash-modal-panel flex h-full w-screen ${WIDTH_CLASS[width]} flex-col overflow-hidden border-l shadow-xl transition-transform duration-200 ease-out focus:outline-none ${
            visible ? 'translate-x-0' : 'translate-x-full'
          } ${className ?? ''}`}
        >
          <div className="dash-modal-header flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              {icon ? <span className="mt-0.5 shrink-0 text-[var(--dash-text-muted)]">{icon}</span> : null}
              <div className="min-w-0">
                {eyebrow ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--dash-text-subtle)]">
                    {eyebrow}
                  </p>
                ) : null}
                {title ? (
                  <h2 className="truncate text-lg font-semibold text-[var(--dash-text-strong)]">{title}</h2>
                ) : null}
                {description ? (
                  <div className="mt-0.5 text-sm text-[var(--dash-text-muted)]">{description}</div>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerAside}
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="dash-modal-footer flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
