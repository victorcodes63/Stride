import type {
  LegalObligationCategory,
  LegalObligationPriority,
  LegalObligationStatus,
} from '@/lib/legal/constants';

export type ObligationOwner = { id: string; name: string; email: string };

export type ObligationRecord = {
  id: string;
  title: string;
  description: string | null;
  category: LegalObligationCategory;
  priority: LegalObligationPriority;
  dueDate: string;
  status: LegalObligationStatus;
  regulator: string | null;
  reminderDays: number;
  recurrenceMonths: number | null;
  completedAt: string | null;
  waivedReason: string | null;
  evidencePath: string | null;
  evidenceFileName: string | null;
  notes: string | null;
  owner: ObligationOwner | null;
  createdAt: string;
  updatedAt: string;
};

export type ObligationEventType =
  | 'created'
  | 'updated'
  | 'assigned'
  | 'status_changed'
  | 'completed'
  | 'waived'
  | 'reopened'
  | 'evidence_uploaded'
  | 'evidence_removed';

export type ObligationEvent = {
  id: string;
  type: ObligationEventType;
  fromStatus: LegalObligationStatus | null;
  toStatus: LegalObligationStatus | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
};

export type ObligationDetail = ObligationRecord & { events: ObligationEvent[] };

export type ObligationListResponse = {
  records: ObligationRecord[];
  total: number;
  page: number;
  pageSize: number;
  owners: ObligationOwner[];
  summary: { total: number; dueSoon: number; overdue: number; completed: number };
};

export type ObligationFormState = {
  title: string;
  category: LegalObligationCategory;
  priority: LegalObligationPriority;
  dueDate: string;
  reminderDays: string;
  recurrenceMonths: string;
  ownerUserId: string;
  regulator: string;
  description: string;
  notes: string;
};

export const EMPTY_OBLIGATION_FORM: ObligationFormState = {
  title: '',
  category: 'filing',
  priority: 'medium',
  dueDate: '',
  reminderDays: '30',
  recurrenceMonths: '',
  ownerUserId: '',
  regulator: '',
  description: '',
  notes: '',
};
