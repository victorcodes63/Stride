import type { ReactNode } from 'react';
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABEL,
  REGISTER_STATUS_BADGE_CLASS,
  REGISTER_STATUS_LABEL,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  type LegalObligationPriority,
  type LegalObligationStatus,
  type ObligationRegisterStatus,
} from '@/lib/legal/constants';

const BASE_CLASS =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`${BASE_CLASS} ${className}`}>{children}</span>;
}

export function LegalStatusBadge({ status }: { status: LegalObligationStatus }) {
  return <Badge className={STATUS_BADGE_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function RegisterStatusBadge({ status }: { status: ObligationRegisterStatus }) {
  return <Badge className={REGISTER_STATUS_BADGE_CLASS[status]}>{REGISTER_STATUS_LABEL[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: LegalObligationPriority }) {
  return <Badge className={PRIORITY_BADGE_CLASS[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}
