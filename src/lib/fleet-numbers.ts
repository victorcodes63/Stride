import type { PrismaClient } from '@prisma/client';

const YEAR = () => new Date().getFullYear();

export async function nextFleetOrderNumber(
  prisma: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const prefix = `ORD-${YEAR()}-`;
  const latest = await prisma.fleetOrder.findFirst({
    where: { outsourcingClientId, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  const seq = latest ? parseInt(latest.orderNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function nextFleetTripNumber(
  prisma: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const prefix = `TR-${YEAR()}-`;
  const latest = await prisma.fleetTrip.findFirst({
    where: { outsourcingClientId, tripNumber: { startsWith: prefix } },
    orderBy: { tripNumber: 'desc' },
    select: { tripNumber: true },
  });
  const seq = latest ? parseInt(latest.tripNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/** Rough Kenya road freight estimate: ~0.35 L/km for rigid, ~0.42 L/km for prime mover. */
export function estimateFuelLiters(distanceKm: number, vehicleType?: string | null): number {
  const rate =
    vehicleType?.toLowerCase().includes('prime') ||
    vehicleType?.toLowerCase().includes('actros') ||
    vehicleType?.toLowerCase().includes('volvo')
      ? 0.42
      : 0.35;
  return Math.round(distanceKm * rate * 10) / 10;
}

/** Average corridor speed assumption for ETA (km/h). */
export function estimateTransitHours(distanceKm: number, isCrossBorder = false): number {
  const avgKph = isCrossBorder ? 45 : 55;
  return Math.round((distanceKm / avgKph) * 10) / 10;
}
