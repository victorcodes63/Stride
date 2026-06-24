import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { sumCreditTotalForInvoice } from '@/lib/accounts-credit-note-totals';

type DbLike = Prisma.TransactionClient | typeof prisma;

/**
 * Updates `AccountsInvoice.status` from line totals vs sum of receipt allocations.
 */
export async function recomputeInvoiceStatusesForInvoiceIds(
  db: DbLike,
  invoiceIds: string[],
): Promise<void> {
  const unique = [...new Set(invoiceIds.filter(Boolean))];
  for (const invoiceId of unique) {
    const inv = await db.accountsInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, allocations: true },
    });
    if (!inv) continue;

    const { totalIncVat } = computeInvoiceVatFromLines(inv.lines, inv.vatRateBps);
    const allocated = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
    const credited = await sumCreditTotalForInvoice(db, invoiceId);
    const covered = allocated + credited;
    const eps = 0.005;
    let status: 'unpaid' | 'partial' | 'paid';
    if (totalIncVat <= eps && covered <= eps) {
      status = 'unpaid';
    } else if (covered + eps >= totalIncVat) {
      status = 'paid';
    } else if (covered > eps) {
      status = 'partial';
    } else {
      status = 'unpaid';
    }

    if (inv.status !== status) {
      await db.accountsInvoice.update({
        where: { id: invoiceId },
        data: { status },
      });
    }
  }
}
