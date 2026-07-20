import type { NextRequest } from 'next/server';
import type { Prisma, PrismaClient } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

/**
 * A payroll surface. `internal` = the company's own staff payroll (HR & Payroll module).
 * `outsourcing` = per end-client payroll (HR Outsourcing module). The two surfaces share
 * one implementation but never share licensing, scope, or navigation.
 */
export type PayrollScope = 'internal' | 'outsourcing';

export type PayrollHandlerOptions = {
  scope: PayrollScope;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Dashboard base path for the payroll surface (used in notification hrefs). */
export function payrollBasePath(scope: PayrollScope): string {
  return scope === 'internal' ? '/dashboard/payroll' : '/dashboard/outsourcing/payroll';
}

/** API base path for the payroll surface (used in audit route labels). */
export function payrollApiBase(scope: PayrollScope): string {
  return scope === 'internal' ? '/api/payroll' : '/api/outsourcing/payroll';
}

/**
 * Resolve the target OutsourcingClient for a payroll request.
 *
 * Internal payroll always targets the company's own workforce (the primary workspace
 * client / active operating entity) and IGNORES any inbound end-client id, so it stays
 * fully independent of the HR Outsourcing module. Outsourcing payroll uses the requested
 * end-client id.
 */
export async function resolvePayrollClientId(
  scope: PayrollScope,
  db: DbClient,
  requestedClientId: string | null | undefined,
  request: NextRequest,
  organizationId: string,
): Promise<string> {
  const requested = scope === 'internal' ? null : requestedClientId ?? null;
  return resolvePrimaryWorkspaceClientId(db, requested, request, organizationId);
}
