/**
 * ==============================================================================
 * Geospatial Navigation & Corridor Math (src/utils/geo.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * Calculating distances and routes on planet Earth isn't like drawing on flat paper,
 * because the Earth is a sphere!
 *
 * This file provides the geographic mathematics:
 * 1. `haversineKm` & `haversineMeters`: Calculates the true distance between two GPS coordinates
 *    (accounting for Earth's curvature, Earth Radius = 6,371 km).
 * 2. `estimateMinutes`: Estimates travel time based on realistic urban emergency speeds.
 * 3. `densifyRoute`: Takes a few highway waypoints and breaks them down into smooth GPS points
 *    every 35-40 meters so the ambulance icon glides smoothly across the map like an animation.
 * 4. `buildCorridorRoute`: Automatically stitches together a corridor path from the patient's
 *    pickup spot through sequenced traffic light intersections to the destination hospital.
 * ==============================================================================
 */

/**
 * haversineKm(lat1, lon1, lat2, lon2)
 * ------------------------------------------------------------------------------
 * Computes great-circle distance between two GPS points in kilometers.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's average radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * haversineMeters(lat1, lon1, lat2, lon2)
 * ------------------------------------------------------------------------------
 * Computes distance in meters (kilometers * 1000).
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000;
}

/**
 * estimateMinutes(distanceKm, avgKmh)
 * ------------------------------------------------------------------------------
 * Estimates arrival time (ETA in minutes) assuming an average city ambulance speed of 32 km/h.
 * Returns at least 3 minutes to account for initial vehicle takeoff.
 */
export function estimateMinutes(distanceKm: number, avgKmh = 32) {
  return Math.max(3, Math.round((distanceKm / avgKmh) * 60));
}

// Converts degrees to radians for trigonometric calculations
function toRad(value: number) {
  return (value * Math.PI) / 180;
}

/**
 * interpolate(a, b, t)
 * ------------------------------------------------------------------------------
 * Finds a point along the straight line between point A and point B at fraction `t` (from 0.0 to 1.0).
 */
export function interpolate(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * densifyRoute(points, stepMeters)
 * ------------------------------------------------------------------------------
 * Fills in the gaps between major turns by generating intermediate coordinates every ~40 meters.
 * This makes the moving vehicle simulation look realistic and fluid rather than jumping in huge leaps.
 */
export function densifyRoute(points: [number, number][], stepMeters = 40): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[i + 1];
    const dist = haversineMeters(lat1, lng1, lat2, lng2);
    const steps = Math.max(1, Math.ceil(dist / stepMeters));
    for (let s = 0; s < steps; s++) {
      result.push(interpolate(points[i], points[i + 1], s / steps));
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/** Built-in Mysore demo corridor: Accident near Mysore Palace -> JSS Hospital Trauma Wing. */
export const MYSORE_DEMO_ROUTE: [number, number][] = [
  [12.3054, 76.6551],
  [12.3078, 76.6534],
  [12.3101, 76.6518],
  [12.3124, 76.6506],
  [12.3148, 76.6492],
  [12.3176, 76.6474],
  [12.3204, 76.6452],
  [12.3233, 76.6430],
  [12.3264, 76.6406],
  [12.3296, 76.6378],
  [12.3326, 76.6352],
  [12.3354, 76.6324],
  [12.3376, 76.6296],
  [12.3388, 76.6264],
  [12.3395, 76.6228],
];

/**
 * buildCorridorRoute(fromLat, fromLng, toLat, toLng, signals)
 * ------------------------------------------------------------------------------
 * Assembles a route from pickup coordinates to destination hospital coordinates,
 * projecting and routing through intermediate traffic signal intersections.
 */
export function buildCorridorRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  signals: Array<{ latitude: number; longitude: number }>
): [number, number][] {
  const demoEnd = MYSORE_DEMO_ROUTE[MYSORE_DEMO_ROUTE.length - 1];
  const nearDemoStart = Math.abs(fromLat - MYSORE_DEMO_ROUTE[0][0]) < 0.02 && Math.abs(fromLng - MYSORE_DEMO_ROUTE[0][1]) < 0.02;
  const nearDemoEnd = Math.abs(toLat - demoEnd[0]) < 0.02 && Math.abs(toLng - demoEnd[1]) < 0.02;
  if (nearDemoStart && nearDemoEnd) return MYSORE_DEMO_ROUTE;

  const totalDistKm = haversineKm(fromLat, fromLng, toLat, toLng);
  const margin = Math.max(0.04, Math.min(0.12, totalDistKm * 0.004));
  const minLat = Math.min(fromLat, toLat) - margin;
  const maxLat = Math.max(fromLat, toLat) + margin;
  const minLng = Math.min(fromLng, toLng) - margin;
  const maxLng = Math.max(fromLng, toLng) + margin;

  const dx = toLat - fromLat;
  const dy = toLng - fromLng;
  const lenSq = dx * dx + dy * dy;

  const maxPerpDist = Math.max(2000, Math.min(4200, totalDistKm * 160));
  const corridorSignals: { lat: number; lng: number; t: number; perpDist: number }[] = [];

  for (const sig of signals) {
    if (sig.latitude >= minLat && sig.latitude <= maxLat && sig.longitude >= minLng && sig.longitude <= maxLng) {
      if (lenSq > 0) {
        const t = ((sig.latitude - fromLat) * dx + (sig.longitude - fromLng) * dy) / lenSq;
        if (t > 0.03 && t < 0.97) {
          const projLat = fromLat + t * dx;
          const projLng = fromLng + t * dy;
          const perpDist = haversineMeters(sig.latitude, sig.longitude, projLat, projLng);
          if (perpDist <= maxPerpDist) {
            corridorSignals.push({ lat: sig.latitude, lng: sig.longitude, t, perpDist });
          }
        }
      }
    }
  }

  corridorSignals.sort((a, b) => a.t - b.t);

  const keyPoints: [number, number][] = [[fromLat, fromLng]];
  const minSpacing = Math.max(600, Math.min(2200, (totalDistKm / 8) * 1000));

  for (const s of corridorSignals) {
    const last = keyPoints[keyPoints.length - 1];
    if (haversineMeters(last[0], last[1], s.lat, s.lng) >= minSpacing) {
      const distLastToDest = haversineMeters(last[0], last[1], toLat, toLng);
      const distSToDest = haversineMeters(s.lat, s.lng, toLat, toLng);
      // Ensure forward progression toward destination
      if (distSToDest < distLastToDest - 300) {
        keyPoints.push([s.lat, s.lng]);
      }
    }
  }
  keyPoints.push([toLat, toLng]);

  if (keyPoints.length === 2) {
    return [
      [fromLat, fromLng],
      [(fromLat + toLat) / 2 + 0.002, (fromLng + toLng) / 2 - 0.002],
      [toLat, toLng],
    ];
  }

  return keyPoints;
}
