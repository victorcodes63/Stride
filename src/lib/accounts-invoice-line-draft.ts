/** Draft invoice line with unit price × quantity → ex-VAT line total. */

export type InvoiceLineDraft = {
  item: string;
  /** Unit price ex-VAT (not line total). */
  amountExVat: string;
  quantity: string;
  description: string;
};

export function emptyInvoiceLineDraft(): InvoiceLineDraft {
  return { item: '', amountExVat: '', quantity: '', description: '' };
}

export function parseInvoiceLineQuantity(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) return 1;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

/** Line total ex-VAT = unit price × quantity (2 dp). */
export function lineTotalExVat(unitPriceStr: string, quantityStr?: string): number | null {
  const unit = parseFloat(unitPriceStr);
  const qty = parseInvoiceLineQuantity(quantityStr);
  if (!Number.isFinite(unit) || unit <= 0) return null;
  return Math.round(unit * qty * 100) / 100;
}

export function invoiceLineDraftsToAmounts(
  lines: Pick<InvoiceLineDraft, 'amountExVat' | 'quantity'>[],
): { amountExVat: number }[] {
  return lines
    .map((l) => {
      const total = lineTotalExVat(l.amountExVat, l.quantity);
      if (total === null) return null;
      return { amountExVat: total };
    })
    .filter(Boolean) as { amountExVat: number }[];
}

export function invoiceLineDraftsToPayload(
  lines: InvoiceLineDraft[],
): { item: string; amountExVat: number; description?: string }[] {
  return lines
    .map((l) => {
      const item = l.item.trim();
      const total = lineTotalExVat(l.amountExVat, l.quantity);
      if (!item || total === null) return null;
      const description = l.description.trim();
      return {
        item,
        amountExVat: total,
        ...(description ? { description } : {}),
      };
    })
    .filter(Boolean) as { item: string; amountExVat: number; description?: string }[];
}
