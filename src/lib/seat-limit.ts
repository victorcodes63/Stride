/**
 * Active-employee metering. Plans are priced per active employee per month
 * (`@/lib/pricing`) with no headcount cap, so this counts for billing and never blocks.
 */
import type { Prisma } from '@prisma/client';

import { withOrgContext } from '@/lib/org-context';
import { prisma } from '@/lib/prisma';

export async function countBillableEmployees(
  outsourcingClientId: string,
  organizationId?: string,
): Promise<number> {
  const countInTx = (tx: Prisma.TransactionClient) =>
    tx.employee.count({
      where: {
        outsourcingClientId,
        employmentStatus: { in: ['active', 'probation'] },
      },
    });

  if (organizationId) {
    return withOrgContext(organizationId, countInTx);
  }

  return prisma.employee.count({
    where: {
      outsourcingClientId,
      employmentStatus: { in: ['active', 'probation'] },
    },
  });
}

/** Reports the month's billable headcount — the input the control plane invoices on. */
export async function reportSeatUsageToControlPlane(
  activeEmployees: number,
): Promise<void> {
  const baseUrl = process.env.CONTROL_PLANE_URL?.trim();
  const slug = process.env.CONTROL_PLANE_CUSTOMER_SLUG?.trim();
  if (!baseUrl || !slug) return;

  const apiKey = process.env.CONTROL_PLANE_INSTANCE_API_KEY?.trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/usage`;
  await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ slug, activeEmployees }),
  }).catch(() => undefined);
}
