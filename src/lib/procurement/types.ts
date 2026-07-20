import type { DashStatusTone } from '@/lib/dashboard-status-chips';

/**
 * Canonical procurement types + formatting/tone helpers.
 *
 * This is the single source of truth for money/date formatting and status → chip-tone mapping
 * across the procurement module. It replaces the `fmtMoney` / `STATUS_STYLES` snippets that were
 * copy-pasted into the individual page components.
 */

// --- Status string unions (mirror the Prisma enums) ------------------------

export type PurchaseRequestStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type PurchaseOrderStatus = 'draft' | 'issued' | 'fulfilled' | 'cancelled';

export type GoodsReceiptStatus = 'draft' | 'posted' | 'cancelled';

export type PurchaseOrderMatchStatus =
  | 'not_matched'
  | 'partially_matched'
  | 'matched'
  | 'exception';

export type PurchaseApprovalStepStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'skipped';

// --- Money & date formatting ----------------------------------------------

/**
 * Canonical procurement money formatter. Renders `1,234.56 KES` — matching the historical
 * `fmtMoney` output used across the procurement pages. Argument order is `(currency, amount)`.
 */
export function formatProcurementMoney(currency: string, amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return (
    value.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    ' ' +
    (currency || 'KES')
  );
}

/** Canonical short date formatter for procurement documents. Accepts Date | ISO string | null. */
export function formatProcurementDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

// --- Human-readable status labels -----------------------------------------

export const PURCHASE_ORDER_MATCH_STATUS_LABEL: Record<PurchaseOrderMatchStatus, string> = {
  not_matched: 'Not matched',
  partially_matched: 'Partially matched',
  matched: 'Matched',
  exception: 'Exception',
};

export const PURCHASE_APPROVAL_STEP_STATUS_LABEL: Record<PurchaseApprovalStepStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
};

// --- Status → chip tone mappers (compatible with dashStatusChip) -----------

export function purchaseRequestStatusTone(status: string): DashStatusTone {
  switch (status) {
    case 'approved':
      return 'success';
    case 'submitted':
      return 'info';
    case 'rejected':
      return 'danger';
    case 'draft':
      return 'neutral';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function purchaseOrderStatusTone(status: string): DashStatusTone {
  switch (status) {
    case 'fulfilled':
      return 'success';
    case 'issued':
      return 'info';
    case 'draft':
      return 'neutral';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function goodsReceiptStatusTone(status: string): DashStatusTone {
  switch (status) {
    case 'posted':
      return 'success';
    case 'draft':
      return 'neutral';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function purchaseOrderMatchStatusTone(status: string): DashStatusTone {
  switch (status) {
    case 'matched':
      return 'success';
    case 'partially_matched':
      return 'warning';
    case 'exception':
      return 'danger';
    case 'not_matched':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function purchaseApprovalStepStatusTone(status: string): DashStatusTone {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
      return 'danger';
    case 'skipped':
      return 'neutral';
    default:
      return 'neutral';
  }
}
