import type { Prisma } from '@prisma/client';

export type SalesCloseGateResult = {
  ok: boolean;
  warnings: string[];
};

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
