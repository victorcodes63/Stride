export type MpesaDisbursementRow = {
  lineId: string;
  batchId: string;
  payrollMonth: number;
  payrollYear: number;
  employeeName: string;
  amount: number;
  phone: string | null;
  providerRef: string | null;
  status: string;
  reconciled: boolean;
};

export type MpesaReceiptRow = {
  paymentId: string;
  clientName: string;
  receivedAt: string;
  amount: number;
  reference: string | null;
  method: string | null;
  allocatedTotal: number;
  unmatchedBalance: number;
};

export function isMpesaMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return /m-?pesa/i.test(method);
}

export function normalizeMpesaRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const t = ref.trim().toUpperCase();
  return t || null;
}

/** Match client receipts to disbursement provider refs by normalized reference. */
export function matchMpesaReferences(
  disbursements: Array<{ lineId: string; providerRef: string | null }>,
  receipts: Array<{ paymentId: string; reference: string | null }>,
): Map<string, string> {
  const byRef = new Map<string, string>();
  for (const d of disbursements) {
    const ref = normalizeMpesaRef(d.providerRef);
    if (ref) byRef.set(ref, d.lineId);
  }
  const matches = new Map<string, string>();
  for (const r of receipts) {
    const ref = normalizeMpesaRef(r.reference);
    if (!ref) continue;
    const lineId = byRef.get(ref);
    if (lineId) matches.set(r.paymentId, lineId);
  }
  return matches;
}
