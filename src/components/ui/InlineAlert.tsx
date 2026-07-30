import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type InlineAlertTone = 'error' | 'warning' | 'success' | 'info';

const TONE: Record<InlineAlertTone, { wrap: string; Icon: LucideIcon }> = {
  error: {
    wrap: 'border-red-200 bg-red-50 text-red-800',
    Icon: AlertTriangle,
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-900',
    Icon: AlertTriangle,
  },
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Icon: CheckCircle2,
  },
  info: {
    wrap: 'border-sky-200 bg-sky-50 text-sky-900',
    Icon: Info,
  },
};

type InlineAlertProps = {
  tone?: InlineAlertTone;
  children: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
};

export default function InlineAlert({
  tone = 'error',
  children,
  className = '',
  role = 'alert',
}: InlineAlertProps) {
  const { wrap, Icon } = TONE[tone];
  return (
    <div
      role={role}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${wrap} ${className}`.trim()}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
