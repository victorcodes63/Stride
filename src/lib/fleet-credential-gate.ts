import type { FleetTripStatus, Prisma, PrismaClient } from '@prisma/client';
import { isFleetComplianceComplete } from '@/lib/fleet-compliance';
import { TripStatusTransitionError } from '@/lib/fleet-trip-status-change';

const ACTIVE_CRED_STATUSES = ['active', 'expiring_soon'] as const;

export function isDriverLicenceValid(
  licenceExpiry: Date | null | undefined,
  asOf = new Date(),
): boolean {
  if (!licenceExpiry) return false;
  const expiry = new Date(licenceExpiry);
  expiry.setHours(23, 59, 59, 999);
  return expiry >= asOf;
}

export class FleetCredentialGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FleetCredentialGateError';
  }
}

type DriverLicenceInput = {
  fullName: string;
  licenceExpiry: Date | null;
  employeeId: string | null;
  licenceNumber: string | null;
};

export async function evaluateDriverLicence(
  prisma: PrismaClient | Prisma.TransactionClient,
  driver: DriverLicenceInput,
): Promise<{ valid: boolean; reason?: string }> {
  if (isDriverLicenceValid(driver.licenceExpiry)) {
    return { valid: true };
  }

  if (driver.employeeId) {
    const creds = await prisma.employeeCredential.findMany({
      where: {
        employeeId: driver.employeeId,
        OR: [
          { credentialName: { contains: 'licen', mode: 'insensitive' } },
          { credentialName: { contains: 'driving', mode: 'insensitive' } },
          ...(driver.licenceNumber ? [{ credentialNumber: driver.licenceNumber }] : []),
        ],
      },
    });
    const validCred = creds.find((c) => {
      if (!ACTIVE_CRED_STATUSES.includes(c.status as (typeof ACTIVE_CRED_STATUSES)[number])) {
        return false;
      }
      if (c.expiryDate && c.expiryDate < new Date()) return false;
      return true;
    });
    if (validCred) return { valid: true };
  }

  if (!driver.licenceExpiry) {
    return {
      valid: false,
      reason: `Driver ${driver.fullName} has no valid licence on file.`,
    };
  }
  return {
    valid: false,
    reason: `Driver ${driver.fullName} licence expired on ${driver.licenceExpiry.toISOString().slice(0, 10)}.`,
  };
}

export async function assertDriverEligibleForAllocation(
  prisma: PrismaClient,
  driverId: string,
) {
  const driver = await prisma.fleetDriver.findUnique({
    where: { id: driverId },
    select: {
      fullName: true,
      licenceExpiry: true,
      employeeId: true,
      licenceNumber: true,
    },
  });
  if (!driver) throw new FleetCredentialGateError('Driver not found.');

  const licence = await evaluateDriverLicence(prisma, driver);
  if (!licence.valid) {
    throw new FleetCredentialGateError(licence.reason ?? 'Driver licence is not valid.');
  }
}

export async function syncDriverLicenceComplianceCheck(
  tx: Prisma.TransactionClient,
  tripId: string,
  driverId: string | null,
) {
  if (!driverId) return;

  const driver = await tx.fleetDriver.findUnique({
    where: { id: driverId },
    select: {
      fullName: true,
      licenceExpiry: true,
      employeeId: true,
      licenceNumber: true,
    },
  });
  if (!driver) return;

  const licence = await evaluateDriverLicence(tx, driver);
  const existing = await tx.fleetTripComplianceCheck.findUnique({
    where: { tripId_checkType: { tripId, checkType: 'driver_licence' } },
    select: { result: true },
  });
  if (existing?.result === 'waived') return;

  await tx.fleetTripComplianceCheck.upsert({
    where: { tripId_checkType: { tripId, checkType: 'driver_licence' } },
    create: {
      tripId,
      checkType: 'driver_licence',
      result: licence.valid ? 'passed' : 'failed',
      notes: licence.valid ? null : licence.reason ?? null,
      checkedAt: new Date(),
    },
    update: {
      result: licence.valid ? 'passed' : 'failed',
      notes: licence.valid ? null : licence.reason ?? null,
      checkedAt: new Date(),
    },
  });
}

export async function assertTripStatusGates(
  tx: Prisma.TransactionClient,
  tripId: string,
  to: FleetTripStatus,
  actor: 'staff' | 'driver',
) {
  if (to === 'loaded' || to === 'in_transit') {
    const checks = await tx.fleetTripComplianceCheck.findMany({ where: { tripId } });
    if (checks.some((c) => c.result === 'failed')) {
      throw new TripStatusTransitionError(
        'Compliance checks failed — resolve or waive before advancing.',
      );
    }
    if (!isFleetComplianceComplete(checks)) {
      throw new TripStatusTransitionError(
        'All pre-trip compliance checks must pass before advancing.',
      );
    }
  }

  if (to === 'in_transit') {
    const deliveryNote = await tx.fleetTripDocument.findFirst({
      where: { tripId, docType: 'delivery_note' },
      select: { id: true },
    });
    if (!deliveryNote) {
      throw new TripStatusTransitionError(
        'Dispatch requires a delivery note — use the Dispatch action.',
      );
    }
  }

  if (to === 'delivered') {
    const verifiedPod = await tx.fleetTripDocument.findFirst({
      where: { tripId, docType: 'pod', verifiedAt: { not: null } },
      select: { id: true },
    });
    if (!verifiedPod) {
      throw new TripStatusTransitionError(
        actor === 'driver'
          ? 'Upload POD and wait for operations to verify before marking delivered.'
          : 'Verified POD required — approve POD before marking delivered.',
      );
    }
  }
}

export async function tripHasVerifiedPod(
  prisma: PrismaClient | Prisma.TransactionClient,
  tripId: string,
): Promise<boolean> {
  const doc = await prisma.fleetTripDocument.findFirst({
    where: { tripId, docType: 'pod', verifiedAt: { not: null } },
    select: { id: true },
  });
  return Boolean(doc);
}
