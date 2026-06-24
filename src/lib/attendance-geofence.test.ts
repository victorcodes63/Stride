import { describe, expect, it } from 'vitest';
import { distanceMeters, evaluateGeofence } from './attendance-geofence';

describe('attendance-geofence (RAV-123)', () => {
  const hq = {
    id: 'site-1',
    name: 'Heritage HQ',
    latitude: -1.2674,
    longitude: 36.8116,
    radiusMeters: 200,
  };

  it('returns zero distance at the site centre', () => {
    expect(distanceMeters(hq.latitude, hq.longitude, hq.latitude, hq.longitude)).toBeLessThan(1);
  });

  it('detects inside geofence', () => {
    const result = evaluateGeofence(-1.2675, 36.8117, [hq]);
    expect(result.inside).toBe(true);
    expect(result.matchedSite?.name).toBe('Heritage HQ');
  });

  it('rejects far-away coordinates', () => {
    const result = evaluateGeofence(-1.3, 36.9, [hq]);
    expect(result.inside).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(hq.radiusMeters);
  });
});
