export type WorkSiteGeofence = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type GeofenceEvaluation = {
  inside: boolean;
  matchedSite: WorkSiteGeofence | null;
  distanceMeters: number | null;
};

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance between two WGS-84 points in metres. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function evaluateGeofence(
  latitude: number,
  longitude: number,
  sites: WorkSiteGeofence[],
): GeofenceEvaluation {
  if (!sites.length) {
    return { inside: false, matchedSite: null, distanceMeters: null };
  }

  let nearest: { site: WorkSiteGeofence; distance: number } | null = null;
  for (const site of sites) {
    const distance = distanceMeters(latitude, longitude, site.latitude, site.longitude);
    if (distance <= site.radiusMeters) {
      return { inside: true, matchedSite: site, distanceMeters: Math.round(distance) };
    }
    if (!nearest || distance < nearest.distance) {
      nearest = { site, distance };
    }
  }

  return {
    inside: false,
    matchedSite: null,
    distanceMeters: nearest ? Math.round(nearest.distance) : null,
  };
}

export function toWorkSiteGeofence(site: {
  id: string;
  name: string;
  latitude: { toNumber(): number } | number;
  longitude: { toNumber(): number } | number;
  radiusMeters: number;
}): WorkSiteGeofence {
  return {
    id: site.id,
    name: site.name,
    latitude: typeof site.latitude === 'number' ? site.latitude : site.latitude.toNumber(),
    longitude: typeof site.longitude === 'number' ? site.longitude : site.longitude.toNumber(),
    radiusMeters: site.radiusMeters,
  };
}
