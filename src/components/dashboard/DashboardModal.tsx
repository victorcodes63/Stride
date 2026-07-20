'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DashboardModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  size?: ModalSize;
  /** Content rendered inside the scrollable body. */
  children: ReactNode;
  /** Sticky footer, typically action buttons. */
  footer?: ReactNode;
  /** When false, clicking the backdrop will not close the modal (e.g. while saving). */
  dismissible?: boolean;
  /** Hide the default header close (X) button. */
  hideClose?: boolean;
  className?: string;
};

/**
 * Reusable design-system modal shell: portal + focus-trap + scroll-lock + Escape.
 * Replaces the hand-rolled `fixed inset-0` overlays scattered across the dashboard.
 */
export function DashboardModal({
  open,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  children,
  footer,
  dismissible = true,
  hideClose = false,
  className,
}: DashboardModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  const requestClose = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  // Scroll lock + Escape + focus management.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

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

    // Move focus into the panel.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(FOCUSABLE);
      (focusable ?? panel).focus();
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      cancelAnimationFrame(raf);
      previouslyFocused.current?.focus?.();
    };
  }, [open, requestClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={requestClose}
        className="dash-modal-backdrop absolute inset-0 backdrop-blur-sm"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={`dash-modal-panel relative flex max-h-[90vh] w-full ${SIZE_CLASS[size]} flex-col overflow-hidden rounded-xl border shadow-xl focus:outline-none ${className ?? ''}`}
      >
        {title || !hideClose ? (
          <div className="dash-modal-header flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              {icon ? <span className="mt-0.5 shrink-0 text-[var(--dash-text-muted)]">{icon}</span> : null}
              <div className="min-w-0">
                {title ? (
                  <h2 className="truncate text-base font-semibold text-[var(--dash-text-strong)]">{title}</h2>
                ) : null}
                {description ? (
                  <div className="mt-0.5 text-sm text-[var(--dash-text-muted)]">{description}</div>
                ) : null}
              </div>
            </div>
            {!hideClose ? (
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="dash-modal-footer flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
