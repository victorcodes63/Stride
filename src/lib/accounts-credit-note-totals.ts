import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type DbLike = Prisma.TransactionClient | typeof prisma;

/** Sum of stored credit note totals (incl. VAT) per sales invoice id. */
export async function sumCreditTotalsByInvoiceIds(
  db: DbLike,
  invoiceIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(invoiceIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await db.accountsCreditNote.groupBy({
    by: ['originalInvoiceId'],
    where: { originalInvoiceId: { in: unique } },
    _sum: { totalIncVat: true },
  });

  const m = new Map<string, number>();
  for (const row of rows) {
    m.set(row.originalInvoiceId, Number(row._sum.totalIncVat ?? 0));
  }
  return m;
}

export async function sumCreditTotalForInvoice(db: DbLike, invoiceId: string): Promise<number> {
  const r = await db.accountsCreditNote.aggregate({
    where: { originalInvoiceId: invoiceId },
    _sum: { totalIncVat: true },
  });
  return Number(r._sum.totalIncVat ?? 0);
}
