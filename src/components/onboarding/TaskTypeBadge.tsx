'use client';

import { FileText, ListChecks, Paperclip, PenLine, type LucideIcon } from 'lucide-react';

export type TaskType = 'CHECKLIST' | 'DOCUMENT' | 'FORM' | 'SIGNATURE';

const TYPE_META: Record<TaskType, { label: string; icon: LucideIcon }> = {
  CHECKLIST: { label: 'Checklist', icon: ListChecks },
  DOCUMENT: { label: 'Document', icon: Paperclip },
  FORM: { label: 'Form', icon: FileText },
  SIGNATURE: { label: 'Signature', icon: PenLine },
};

/** Small pill identifying how a workflow task is completed. */
export function TaskTypeBadge({ type, className }: { type: TaskType; className?: string }) {
  const meta = TYPE_META[type] ?? TYPE_META.CHECKLIST;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--dash-text-body)] ${className ?? ''}`}
    >
      <Icon className="h-3 w-3 text-primary-600" aria-hidden />
      {meta.label}
    </span>
  );
}
