import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';

export const SUPPORT_TICKET_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  incident: 'Something is broken',
  service_request: 'How-to / configuration',
  access_permissions: 'Access & permissions',
  payroll_statutory: 'Payroll & statutory',
  data_import: 'Data import / export',
  billing_account: 'Billing & account',
  feature_request: 'Feature request',
  other: 'Other',
};

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent — blocking work',
};

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  waiting_on_customer: 'Waiting on you',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const SUPPORT_TICKET_STATUS_TONE: Record<
  SupportTicketStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'muted'
> = {
  submitted: 'info',
  acknowledged: 'info',
  in_progress: 'warning',
  waiting_on_customer: 'warning',
  resolved: 'success',
  closed: 'muted',
};
