/**
 * ==============================================================================
 * Predictive Intelligent Green Corridor Service (src/services/greenCorridor.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * When an ambulance is transporting a patient in critical condition, every red light
 * delays medical care. However, turning every traffic light green across an entire city
 * at the same time causes massive traffic jams on cross-streets.
 *
 * This service implements "Sequential Just-in-Time Priority":
 * 1. Tracks the ambulance along its planned route.
 * 2. Calculates speed (~45 km/h = 12.5 meters/second).
 * 3. Exactly ~30 seconds before reaching an upcoming intersection (~380 meters away),
 *    it turns ONLY that specific traffic light SOLID GREEN.
 * 4. Cross-traffic is held at red to clear the intersection.
 * 5. As soon as the ambulance crosses the intersection, the light is immediately
 *    released back to the normal cycle, preventing traffic congestion!
 * 6. When the ambulance reaches the hospital doors, all signals are fully released.
 * ==============================================================================
 */

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { haversineMeters } from "../utils/geo.js";
import { emitLive, emitToEmergency, emitToRole } from "../sockets/index.js";

type SignalRow = {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  mode: string;
  sequenceOrder: number;
};

const SIMULATION_SAFETY_NOTE =
  "SIMULATION ONLY. Sequential priority is emulated for the hackathon and is not connected to public traffic signals.";

// Speed of simulated ambulance: ~45 km/h = 12.5 m/s
// In 30 seconds, ambulance covers: 30 * 12.5 = 375 meters.
const PREEMPTION_SECONDS = 30;
const PREEMPTION_DISTANCE_METERS = 380;
const SPEED_MPS = 12.5;

/**
 * Predictive Green Corridor Simulation
 * - Identifies traffic signal intersections along the selected route.
 * - Computes estimated arrival time (ETA) for each intersection.
 * - Sequentially preempts ONLY the upcoming intersection to GREEN approximately 30 seconds before arrival.
 * - Keeps priority active until ambulance crosses the intersection.
 * - Restores crossed intersection to normal traffic operation.
 * - Never activates multiple signals simultaneously.
 * - Fully releases all signals on arrival or reset.
 */
export async function evaluateGreenCorridor(params: {
  emergencyId: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  arrived?: boolean;
  reset?: boolean;
}) {
  const { emergencyId, lat, lng, arrived, reset } = params;
  const allSignals = await prisma.trafficSignal.findMany({ orderBy: { sequenceOrder: "asc" } });

  // 1. Handle Arrival or Reset: Release all signals
  if (arrived || reset) {
    await releaseAll(emergencyId, allSignals);
    await prisma.emergencyRequest.update({
      where: { id: emergencyId },
      data: { greenCorridorActive: false },
    });
    const freshSignals = await snapshot(allSignals);
    const payload = {
      emergencyId,
      corridorActive: false,
      reason: arrived ? "ARRIVED" : "RESET",
      activeSignal: null,
      nextSignal: null,
      signals: freshSignals,
      demo: true,
      safetyNote: SIMULATION_SAFETY_NOTE,
    };
    emitLive("corridor:update", payload);
    emitToRole("TRAFFIC_CONTROL", "corridor:update", payload);
    emitToEmergency(emergencyId, "corridor:update", payload);
    return payload;
  }

  // 2. Fetch emergency details & route geometry
  const emergency = await prisma.emergencyRequest.findUnique({
    where: { id: emergencyId },
    select: { routeJson: true },
  });

  let route: [number, number][] = [];
  if (emergency?.routeJson) {
    try {
      route = JSON.parse(emergency.routeJson);
    } catch {
      route = [];
    }
  }

  // Fetch already completed signals for this emergency
  const completed = await prisma.trafficPriorityRequest.findMany({
    where: { emergencyRequestId: emergencyId, status: "COMPLETED" },
    select: { signalId: true },
  });
  const completedIds = new Set(completed.map((c) => c.signalId));

  // 3. Find ambulance position on route
  let currentAmbIdx = 0;
  if (route.length > 1) {
    let minAmbDist = Infinity;
    for (let i = 0; i < route.length; i++) {
      const d = haversineMeters(lat, lng, route[i][0], route[i][1]);
      if (d < minAmbDist) {
        minAmbDist = d;
        currentAmbIdx = i;
      }
    }
  }

  // 4. Identify intersections along the selected route
  type ScoredSignal = SignalRow & {
    routeIndex: number;
    directDist: number;
    distRemaining: number;
    etaSeconds: number;
    isAlongRoute: boolean;
  };

  const scoredSignals: ScoredSignal[] = allSignals.map((sig) => {
    const directDist = haversineMeters(lat, lng, sig.latitude, sig.longitude);

    if (route.length > 1) {
      // Find closest route waypoint to this signal
      let minWaypointDist = Infinity;
      let closestWaypointIdx = 0;
      for (let i = 0; i < route.length; i++) {
        const d = haversineMeters(sig.latitude, sig.longitude, route[i][0], route[i][1]);
        if (d < minWaypointDist) {
          minWaypointDist = d;
          closestWaypointIdx = i;
        }
      }

      // Signal is on this route if within 850m of route geometry
      const isAlongRoute = minWaypointDist <= 850;

      // Calculate path distance remaining along route
      let pathDist = 0;
      if (closestWaypointIdx >= currentAmbIdx) {
        for (let k = currentAmbIdx; k < closestWaypointIdx; k++) {
          pathDist += haversineMeters(route[k][0], route[k][1], route[k + 1][0], route[k + 1][1]);
        }
      }
      const distRemaining = Math.max(0, Math.min(pathDist || directDist, directDist));
      const etaSeconds = Math.round(distRemaining / SPEED_MPS);

      return {
        ...sig,
        routeIndex: closestWaypointIdx,
        directDist,
        distRemaining,
        etaSeconds,
        isAlongRoute,
      };
    } else {
      const etaSeconds = Math.round(directDist / SPEED_MPS);
      return {
        ...sig,
        routeIndex: sig.sequenceOrder,
        directDist,
        distRemaining: directDist,
        etaSeconds,
        isAlongRoute: directDist <= 5000,
      };
    }
  });

  // Filter signals along the route and sort by their sequential order along the route
  const routeSignals = scoredSignals
    .filter((s) => s.isAlongRoute)
    .sort((a, b) => a.routeIndex - b.routeIndex);

  // 5. Detect and restore crossed signals
  const signalsToRestore: string[] = [];
  for (const s of routeSignals) {
    if (completedIds.has(s.id)) continue;

    // A signal is crossed if:
    // a) Ambulance has passed beyond the signal's waypoint and is moving away (> 45m)
    // b) Or ambulance was within 35m and now distance is increasing / passed
    const isPassedWaypoint = route.length > 1 && currentAmbIdx > s.routeIndex && s.directDist > 45;
    const isCleared = s.directDist <= env.clearMeters;

    if (isPassedWaypoint || (isCleared && currentAmbIdx > s.routeIndex)) {
      signalsToRestore.push(s.id);
      completedIds.add(s.id);
    }
  }

  for (const id of signalsToRestore) {
    await restoreSignal(emergencyId, id);
  }

  // 6. Select immediate upcoming signal
  const upcomingSignals = routeSignals.filter((s) => {
    if (completedIds.has(s.id)) return false;
    // Signal must be ahead of ambulance or currently being traversed
    if (route.length > 1 && s.routeIndex < currentAmbIdx && s.directDist > 50) return false;
    return true;
  });

  const nextUpcoming = upcomingSignals[0] || null;
  const followingUpcoming = upcomingSignals[1] || null;

  let activeSignal: SignalRow | null = null;

  // 7. 30-Second Predictive Preemption:
  // Activate GREEN priority ~30 seconds before reaching the upcoming intersection (or within 380m).
  // Strictly enforce sequential priority: NEVER activate multiple signals at once.
  if (nextUpcoming) {
    const shouldPreempt =
      nextUpcoming.etaSeconds <= PREEMPTION_SECONDS ||
      nextUpcoming.distRemaining <= PREEMPTION_DISTANCE_METERS ||
      nextUpcoming.directDist <= PREEMPTION_DISTANCE_METERS;

    if (shouldPreempt) {
      activeSignal = await activateSignal(emergencyId, nextUpcoming, nextUpcoming.distRemaining);
    }
  }

  // 8. Ensure any signal that is NOT the activeSignal is NOT in EMERGENCY_PRIORITY
  for (const s of allSignals) {
    if (s.mode === "EMERGENCY_PRIORITY" && (!activeSignal || s.id !== activeSignal.id)) {
      await restoreSignal(emergencyId, s.id);
    }
  }

  const corridorActive = Boolean(activeSignal);
  await prisma.emergencyRequest.update({
    where: { id: emergencyId },
    data: { greenCorridorActive: corridorActive },
  });

  const freshSignals = await snapshot(allSignals);

  const payload = {
    emergencyId,
    corridorActive,
    approachMeters: PREEMPTION_DISTANCE_METERS,
    approachSeconds: PREEMPTION_SECONDS,
    activeSignal: activeSignal
      ? {
          id: activeSignal.id,
          code: activeSignal.code,
          name: activeSignal.name,
          status: "GREEN",
          mode: "EMERGENCY_PRIORITY",
          distanceMeters: Math.round(nextUpcoming?.distRemaining ?? 0),
          etaSeconds: nextUpcoming?.etaSeconds ?? 0,
        }
      : null,
    nextSignal: followingUpcoming
      ? {
          id: followingUpcoming.id,
          code: followingUpcoming.code,
          name: followingUpcoming.name,
          distanceMeters: Math.round(followingUpcoming.distRemaining ?? 0),
          etaSeconds: followingUpcoming.etaSeconds ?? 0,
        }
      : null,
    signals: freshSignals,
    demo: true,
    safetyNote: SIMULATION_SAFETY_NOTE,
  };

  emitLive("corridor:update", payload);
  emitToRole("TRAFFIC_CONTROL", "corridor:update", payload);
  emitToEmergency(emergencyId, "corridor:update", payload);
  return payload;
}

async function activateSignal(emergencyId: string, signal: SignalRow, distanceMeters?: number) {
  await prisma.trafficSignal.update({
    where: { id: signal.id },
    data: { mode: "EMERGENCY_PRIORITY", status: "GREEN" },
  });

  const existing = await prisma.trafficPriorityRequest.findFirst({
    where: { emergencyRequestId: emergencyId, signalId: signal.id, status: { in: ["PENDING", "ACTIVE"] } },
  });

  if (existing) {
    await prisma.trafficPriorityRequest.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        distanceMeters: distanceMeters ?? (signal as SignalRow & { distanceMeters?: number }).distanceMeters,
        activatedAt: existing.activatedAt ?? new Date(),
      },
    });
  } else {
    await prisma.trafficPriorityRequest.create({
      data: {
        emergencyRequestId: emergencyId,
        signalId: signal.id,
        status: "ACTIVE",
        distanceMeters: distanceMeters ?? (signal as SignalRow & { distanceMeters?: number }).distanceMeters,
        activatedAt: new Date(),
      },
    });
  }

  return { ...signal, status: "GREEN", mode: "EMERGENCY_PRIORITY" };
}

async function restoreSignal(emergencyId: string, signalId: string) {
  await prisma.trafficSignal.update({
    where: { id: signalId },
    data: { mode: "NORMAL", status: cycleNormal() },
  });
  await prisma.trafficPriorityRequest.updateMany({
    where: { emergencyRequestId: emergencyId, signalId, status: "ACTIVE" },
    data: { status: "COMPLETED", releasedAt: new Date() },
  });
}

async function releaseAll(emergencyId: string, signals: SignalRow[]) {
  for (const signal of signals) {
    await prisma.trafficSignal.update({
      where: { id: signal.id },
      data: { mode: "NORMAL", status: cycleNormal() },
    });
  }
  await prisma.trafficPriorityRequest.updateMany({
    where: { emergencyRequestId: emergencyId, status: { in: ["PENDING", "ACTIVE"] } },
    data: { status: "COMPLETED", releasedAt: new Date() },
  });
}

async function snapshot(signals: SignalRow[]) {
  const fresh = await prisma.trafficSignal.findMany({ orderBy: { sequenceOrder: "asc" } });
  return fresh.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    status: s.status,
    mode: s.mode,
    sequenceOrder: s.sequenceOrder,
    isDemoData: s.isDemoData,
  }));
}

function cycleNormal() {
  const states = ["RED", "GREEN", "YELLOW"];
  return states[Math.floor(Math.random() * states.length)];
}
