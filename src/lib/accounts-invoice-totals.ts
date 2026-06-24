/** Kenya-style invoice VAT on subtotal: round(sum(ex-VAT lines) × rate, 2). */

export function computeInvoiceVatFromSubtotal(
  subtotalExVat: number,
  vatRateBps: number,
): { subtotalExVat: number; vatAmount: number; totalIncVat: number } {
  const rate = vatRateBps / 10000;
  const vatAmount = Math.round(subtotalExVat * rate * 100) / 100;
  const totalIncVat = Math.round((subtotalExVat + vatAmount) * 100) / 100;
  return { subtotalExVat, vatAmount, totalIncVat };
}

export function computeInvoiceVatFromLines(
  lineAmountsExVat: readonly { amountExVat: unknown }[],
  vatRateBps: number,
): { subtotalExVat: number; vatAmount: number; totalIncVat: number } {
  const subtotalExVat = lineAmountsExVat.reduce((s, l) => s + Number(l.amountExVat), 0);
  return computeInvoiceVatFromSubtotal(subtotalExVat, vatRateBps);
}
