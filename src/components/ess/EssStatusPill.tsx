const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-200',
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-200',
  complete: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-200',
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-200',
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-200',
  pending: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-200',
  submitted: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-200',
  pending_review: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-200',
  under_review: 'bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-200',
  investigating: 'bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-200',
  rejected: 'bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-200',
  cancelled: 'bg-[var(--ess-secondary-soft)] text-[var(--ess-muted)] border-[var(--ess-border)]',
  draft: 'bg-[var(--ess-secondary-soft)] text-[var(--ess-muted)] border-[var(--ess-border)]',
};

export function EssStatusPill({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const style = STATUS_STYLES[key] ?? 'bg-[var(--ess-secondary-soft)] text-[var(--ess-muted)] border-[var(--ess-border)]';
  const label = status.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${style}`}>
      {label}
    </span>
  );
}
