/** Simple ETA estimate for in-transit trips. */

export function estimateTripEta(input: {
  plannedDeliveryAt: Date | null;
  plannedDistanceKm: number | null;
  actualDistanceKm: number | null;
  speedKph: number | null;
  recordedAt: Date | null;
}): Date | null {
  if (input.plannedDeliveryAt) {
    return input.plannedDeliveryAt;
  }

  const distanceKm = input.actualDistanceKm ?? input.plannedDistanceKm;
  if (distanceKm == null || distanceKm <= 0) return null;

  const speed = input.speedKph && input.speedKph > 5 ? input.speedKph : 55;
  const hoursRemaining = distanceKm / speed;
  const base = input.recordedAt ?? new Date();
  return new Date(base.getTime() + hoursRemaining * 60 * 60 * 1000);
}

export function formatEta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
