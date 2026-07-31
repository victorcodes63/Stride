import type { Prisma } from '@prisma/client';

export type SalesCloseGateResult = {
  ok: boolean;
  warnings: string[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function invoiceTotalIncVat(inv: {
  vatRateBps: number;
  totalOverrideIncVat: Prisma.Decimal | number | null;
  lines: Array<{ amountExVat: Prisma.Decimal | number }>;
}): number {
  if (inv.totalOverrideIncVat != null && Number.isFinite(Number(inv.totalOverrideIncVat))) {
    return Number(inv.totalOverrideIncVat);
  }
  const sub = inv.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
  return round2(sub * (1 + inv.vatRateBps / 10_000));
}

/** Outstanding AR for a client (invoice totals − payments − credit notes). */
export async function computeClientOutstandingAr(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; accountsClientId: string },
): Promise<number> {
  const invoices = await tx.accountsInvoice.findMany({
    where: {
      organizationId: params.organizationId,
      clientId: params.accountsClientId,
    },
    select: {
      vatRateBps: true,
      totalOverrideIncVat: true,
      lines: { select: { amountExVat: true } },
      allocations: { select: { amount: true } },
      creditNotes: { select: { totalIncVat: true } },
    },
  });

  let outstanding = 0;
  for (const inv of invoices) {
    const total = invoiceTotalIncVat(inv);
    const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
    const credited = inv.creditNotes.reduce((s, cn) => s + Number(cn.totalIncVat), 0);
    outstanding += Math.max(0, round2(total - paid - credited));
  }
  return round2(outstanding);
}

/**
 * Soft credit gate: creditHold flag, or outstanding + proposed > creditLimit.
 * Mirrors Legal gate shape so callers can merge warnings + acknowledgeWarnings.
 */
export async function evaluateSalesCreditGate(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    accountsClientId: string | null;
    proposedAmount?: number | null;
  },
): Promise<SalesCloseGateResult & { outstanding: number | null; creditLimit: number | null }> {
  const warnings: string[] = [];
  if (!params.accountsClientId) {
    return { ok: true, warnings: [], outstanding: null, creditLimit: null };
  }

  const client = await tx.accountsClient.findFirst({
    where: { id: params.accountsClientId, organizationId: params.organizationId },
    select: { creditLimit: true, creditHold: true, name: true },
  });
  if (!client) {
    warnings.push('Accounts client not found for credit check.');
    return { ok: false, warnings, outstanding: null, creditLimit: null };
  }

  if (client.creditHold) {
    warnings.push(`Credit hold is active for ${client.name}.`);
  }

  const outstanding = await computeClientOutstandingAr(tx, {
    organizationId: params.organizationId,
    accountsClientId: params.accountsClientId,
  });
  const creditLimit =
    client.creditLimit != null && Number.isFinite(Number(client.creditLimit))
      ? Number(client.creditLimit)
      : null;
  const proposed = params.proposedAmount != null && Number.isFinite(params.proposedAmount)
    ? Math.max(0, params.proposedAmount)
    : 0;

  if (creditLimit != null && outstanding + proposed > creditLimit + 0.01) {
    warnings.push(
      `Credit exposure ${round2(outstanding + proposed).toLocaleString()} exceeds limit ${creditLimit.toLocaleString()} (outstanding ${outstanding.toLocaleString()}).`,
    );
  }

  return {
    ok: warnings.length === 0,
    warnings,
    outstanding,
    creditLimit,
  };
}

/** Soft Legal gate: missing or overdue MSA/contract for the deal's accounts client. */
export async function evaluateSalesLegalGate(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; accountsClientId: string | null; asOf?: Date },
): Promise<SalesCloseGateResult> {
  const warnings: string[] = [];
  const asOf = params.asOf ?? new Date();

  if (!params.accountsClientId) {
    warnings.push('No accounts client linked — Legal cannot verify an MSA.');
    return { ok: false, warnings };
  }

  const contracts = await tx.accountsContract.findMany({
    where: {
      organizationId: params.organizationId,
      clientId: params.accountsClientId,
    },
    orderBy: { endDate: 'desc' },
    take: 5,
  });

  if (contracts.length === 0) {
    warnings.push('No Legal MSA/contract on file for this client.');
    return { ok: false, warnings };
  }

  const active = contracts.find((c) => c.endDate >= asOf);
  if (!active) {
    const latest = contracts[0]!;
    warnings.push(
      `Client contract expired on ${latest.endDate.toISOString().slice(0, 10)} — renew before close.`,
    );
    return { ok: false, warnings };
  }

  const daysLeft = Math.floor(
    (active.endDate.getTime() - asOf.getTime()) / 86_400_000,
  );
  if (daysLeft <= 60) {
    warnings.push(
      `Client contract ends in ${daysLeft} day(s) (${active.title || active.reference || 'MSA'}).`,
    );
  }

  return { ok: warnings.length === 0, warnings };
}

export type FleetCapacityCheckResult = {
  ok: boolean;
  warnings: string[];
  maxAvailableKg: number | null;
  cargoWeightKg: number | null;
  matchingVehicles: number;
};

/** Soft fleet capacity check against available vehicles with capacityKg. */
export async function evaluateFleetCapacityForDeal(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    cargoWeightKg: number | null | undefined;
    workspaceClientId?: string | null;
  },
): Promise<FleetCapacityCheckResult> {
  const cargo = params.cargoWeightKg != null && params.cargoWeightKg > 0 ? params.cargoWeightKg : null;
  if (cargo == null) {
    return {
      ok: true,
      warnings: [],
      maxAvailableKg: null,
      cargoWeightKg: null,
      matchingVehicles: 0,
    };
  }

  const vehicles = await tx.fleetVehicle.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.workspaceClientId ? { outsourcingClientId: params.workspaceClientId } : {}),
      status: 'available',
      capacityKg: { not: null },
    },
    select: { id: true, capacityKg: true, registration: true },
    take: 50,
  });

  const withCapacity = vehicles.filter((v) => v.capacityKg != null && v.capacityKg > 0);
  const maxAvailableKg = withCapacity.reduce((m, v) => Math.max(m, v.capacityKg ?? 0), 0);
  const matching = withCapacity.filter((v) => (v.capacityKg ?? 0) >= cargo);

  if (withCapacity.length === 0) {
    return {
      ok: false,
      warnings: [`No available fleet vehicles with capacity data for ${cargo.toLocaleString()} kg cargo.`],
      maxAvailableKg: null,
      cargoWeightKg: cargo,
      matchingVehicles: 0,
    };
  }

  if (matching.length === 0) {
    return {
      ok: false,
      warnings: [
        `Cargo ${cargo.toLocaleString()} kg exceeds max available capacity (${maxAvailableKg.toLocaleString()} kg).`,
      ],
      maxAvailableKg,
      cargoWeightKg: cargo,
      matchingVehicles: 0,
    };
  }

  return {
    ok: true,
    warnings: [],
    maxAvailableKg,
    cargoWeightKg: cargo,
    matchingVehicles: matching.length,
  };
}
