'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
  persistent?: boolean;
};

const listeners = new Set<(items: ToastItem[]) => void>();
let queue: ToastItem[] = [];

function emit() {
  for (const listener of listeners) listener(queue);
}

function removeToast(id: string) {
  queue = queue.filter((item) => item.id !== id);
  emit();
}

function pushToast(kind: ToastKind, message: string, persistent = false) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  queue = [...queue, { id, kind, message, persistent }];
  emit();
  if (!persistent && kind !== 'error') {
    setTimeout(() => removeToast(id), 5000);
  }
}

export const toast = {
  success(message: string) {
    pushToast('success', message);
  },
  error(message: string) {
    pushToast('error', message, true);
  },
  info(message: string) {
    pushToast('info', message);
  },
  warning(message: string) {
    pushToast('warning', message);
  },
  dismiss(id: string) {
    removeToast(id);
  },
};

function kindStyles(kind: ToastKind): { border: string; icon: ReactNode } {
  switch (kind) {
    case 'success':
      return { border: 'border-l-green-600', icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> };
    case 'error':
      return { border: 'border-l-red-600', icon: <AlertCircle className="h-5 w-5 text-red-600" /> };
    case 'warning':
      return { border: 'border-l-amber-600', icon: <AlertCircle className="h-5 w-5 text-amber-600" /> };
    default:
      return { border: 'border-l-secondary-500', icon: <Info className="h-5 w-5 text-secondary-500" /> };
  }
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>(queue);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {items.map((item) => {
        const styles = kindStyles(item.kind);
        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-md border border-l-4 border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3 shadow-md transition-all duration-200 ${styles.border}`}
          >
            {styles.icon}
            <p className="flex-1 text-sm text-[var(--dash-text-strong)]">{item.message}</p>
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="rounded p-1 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
