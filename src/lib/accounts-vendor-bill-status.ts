import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';

type DbLike = Prisma.TransactionClient | typeof prisma;

/**
 * Updates `AccountsVendorBill.status` from line totals vs sum of payment allocations.
 */
export async function recomputeVendorBillStatusesForBillIds(
  db: DbLike,
  billIds: string[],
): Promise<void> {
  const unique = [...new Set(billIds.filter(Boolean))];
  for (const billId of unique) {
    const bill = await db.accountsVendorBill.findUnique({
      where: { id: billId },
      include: { lines: true, allocations: true },
    });
    if (!bill) continue;

    const { totalIncVat } = computeInvoiceVatFromLines(bill.lines, bill.vatRateBps);
    const allocated = bill.allocations.reduce((s, a) => s + Number(a.amount), 0);
    const eps = 0.005;
    let status: 'unpaid' | 'partial' | 'paid';
    if (totalIncVat <= eps && allocated <= eps) {
      status = 'unpaid';
    } else if (allocated + eps >= totalIncVat) {
      status = 'paid';
    } else if (allocated > eps) {
      status = 'partial';
    } else {
      status = 'unpaid';
    }

    if (bill.status !== status) {
      await db.accountsVendorBill.update({
        where: { id: billId },
        data: { status },
      });
    }
  }
}
