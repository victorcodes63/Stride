/**
 * OUT-07 — Monthly recurring billing for all active end-clients.
 */
import type { Prisma } from '@prisma/client';
import { generateOutsourcingClientInvoice } from '@/lib/outsourcing-billing';

export type OutsourcingBillingCronResult = {
  period: { month: number; year: number };
  processed: number;
  created: number;
  skipped: number;
  errors: { outsourcingClientId: string; message: string }[];
};

export async function runOutsourcingMonthlyBilling(
  tx: Prisma.TransactionClient,
  input?: { month?: number; year?: number; organizationId?: string },
): Promise<OutsourcingBillingCronResult> {
  const now = new Date();
  const month = input?.month ?? (now.getUTCMonth() === 0 ? 12 : now.getUTCMonth());
  const year = input?.year ?? (now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear());

  const clients = await tx.outsourcingClient.findMany({
    where: {
      status: 'active',
      ...(input?.organizationId ? { organizationId: input.organizationId } : {}),
    },
    select: { id: true, organizationId: true, name: true },
  });

  let created = 0;
  let skipped = 0;
  const errors: OutsourcingBillingCronResult['errors'] = [];

  for (const client of clients) {
    try {
      const existing = await tx.accountsInvoice.findFirst({
        where: {
          organizationId: client.organizationId,
          notes: { contains: `OUT-07 monthly bill for ${client.name}` },
          issueDate: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt: new Date(Date.UTC(year, month, 1)),
          },
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await generateOutsourcingClientInvoice(tx, {
        organizationId: client.organizationId,
        outsourcingClientId: client.id,
        month,
        year,
        mode: 'monthly',
      });
      created += 1;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'NO_BILLABLE_LINES' || err.code === 'PAYROLL_NOT_APPROVED') {
        skipped += 1;
        continue;
      }
      errors.push({
        outsourcingClientId: client.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { period: { month, year }, processed: clients.length, created, skipped, errors };
}
