import { dashStatusChip } from '@/lib/dashboard-status-chips';
import {
  goodsReceiptStatusTone,
  purchaseApprovalStepStatusTone,
  purchaseOrderMatchStatusTone,
  purchaseOrderStatusTone,
  purchaseRequestStatusTone,
  PURCHASE_APPROVAL_STEP_STATUS_LABEL,
  PURCHASE_ORDER_MATCH_STATUS_LABEL,
  type PurchaseApprovalStepStatus,
  type PurchaseOrderMatchStatus,
} from '@/lib/procurement/types';

export type ProcurementStatusKind = 'pr' | 'po' | 'grn' | 'match' | 'approval';

const TONE_MAPPERS: Record<ProcurementStatusKind, (status: string) => ReturnType<typeof purchaseRequestStatusTone>> = {
  pr: purchaseRequestStatusTone,
  po: purchaseOrderStatusTone,
  grn: goodsReceiptStatusTone,
  match: purchaseOrderMatchStatusTone,
  approval: purchaseApprovalStepStatusTone,
};

function defaultLabel(kind: ProcurementStatusKind, status: string): string {
  if (kind === 'match') {
    return PURCHASE_ORDER_MATCH_STATUS_LABEL[status as PurchaseOrderMatchStatus] ?? status;
  }
  if (kind === 'approval') {
    return PURCHASE_APPROVAL_STEP_STATUS_LABEL[status as PurchaseApprovalStepStatus] ?? status;
  }
  return status;
}

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Thin, presentational wrapper around `dashStatusChip` that resolves the correct tone for a
 * procurement status (PR / PO / GRN / 3-way match / approval step). Mirrors the gold-standard
 * asset status chip usage.
 */
export function ProcurementStatusChip({
  kind,
  status,
  label,
  className,
}: {
  kind: ProcurementStatusKind;
  status: string;
  /** Override the rendered label (defaults to a humanized status). */
  label?: string;
  className?: string;
}) {
  const tone = TONE_MAPPERS[kind](status);
  return (
    <span className={cn(dashStatusChip(tone), className)}>
      {label ?? defaultLabel(kind, status)}
    </span>
  );
}
