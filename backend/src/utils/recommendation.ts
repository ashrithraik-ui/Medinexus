/**
 * ==============================================================================
 * Intelligent Multi-Factor Hospital Recommendation Engine (src/utils/recommendation.ts)
 * ==============================================================================
 * What does this file do in plain English?
 * When someone calls an ambulance for a heart attack or severe car accident,
 * driving to the wrong hospital can be fatal. If you arrive and there is no
 * cardiologist on duty or no open ICU beds, the patient must be transferred again.
 *
 * This algorithm acts as an "Automated Clinical Decision Support System":
 * 1. Condition-to-Specialist Mapping:
 *    - Road Accident -> Needs Orthopedic Surgeon & Trauma Bay
 *    - Heart Attack  -> Needs Cardiologist & Cardiac Care Unit
 *    - Pregnancy     -> Needs Gynecologist & Maternity Ward
 * 2. Scoring System (0 to 100 Points):
 *    - Doctor Availability: +40 points if the primary specialist is on-duty.
 *    - Bed Availability: +10 to +25 points based on open ICU/emergency beds.
 *    - Hospital Readiness: +15 points if the facility is marked 'READY'.
 *    - Proximity & Distance: Up to +35 points for hospitals within 3 km.
 *      Hospitals in distant districts (>45 km away) receive heavy penalties
 *      so local hospitals always rank at the top!
 * ==============================================================================
 */

import { haversineKm, estimateMinutes } from "./geo.js";

// Maps emergency condition to the medical specialist required for immediate care
export const SPECIALIST_MAP: Record<string, string[]> = {
  ROAD_ACCIDENT: ["ORTHOPEDIC", "EMERGENCY_MEDICINE"],
  HEART_ATTACK: ["CARDIOLOGIST", "EMERGENCY_MEDICINE"],
  PREGNANCY: ["GYNECOLOGIST", "EMERGENCY_MEDICINE"],
  OTHER: ["GENERAL_PHYSICIAN", "EMERGENCY_MEDICINE"],
};

// Maps emergency condition to the specialized physical facility required
export const FACILITY_MAP: Record<string, (h: HospitalInput) => boolean> = {
  ROAD_ACCIDENT: (h) => h.traumaCapable,
  HEART_ATTACK: (h) => h.cardiacCapable,
  PREGNANCY: (h) => h.maternityCapable,
  OTHER: () => true,
};

export type HospitalInput = {
  id: string;
  name: string;
  city?: string | null;
  latitude: number;
  longitude: number;
  traumaCapable: boolean;
  cardiacCapable: boolean;
  maternityCapable: boolean;
  readinessStatus: string;
  facilities: string;
  beds?: { total: number; available: number } | null;
  doctors: {
    specialization: string;
    availability: { isAvailable: boolean } | null;
  }[];
};

export type Recommendation = {
  hospitalId: string;
  name: string;
  city?: string;
  distanceKm: number;
  etaMinutes: number;
  score: number;
  reasons: string[];
  warnings: string[];
  availableSpecialists: string[];
  availableBeds: number;
  totalBeds: number;
  facilities: string[];
  readinessStatus: string;
  suitable: boolean;
  latitude: number;
  longitude: number;
};

/**
 * recommendHospitals(emergencyType, lat, lng, hospitals)
 * ------------------------------------------------------------------------------
 * Scores and sorts all hospitals from highest suitability to lowest.
 */
export function recommendHospitals(
  emergencyType: string,
  lat: number,
  lng: number,
  hospitals: HospitalInput[],
): Recommendation[] {
  const needed = SPECIALIST_MAP[emergencyType] || SPECIALIST_MAP.OTHER;
  const results = hospitals.map((hospital) => scoreHospital(emergencyType, needed, lat, lng, hospital));

  return results.sort((a, b) => {
    // 1. Local emergency range (<= 45 km) ALWAYS ranks ahead of distant cross-city facilities (> 45 km)
    const aIsLocal = a.distanceKm <= 45;
    const bIsLocal = b.distanceKm <= 45;
    if (aIsLocal && !bIsLocal) return -1;
    if (!aIsLocal && bIsLocal) return 1;

    // 2. Higher clinical suitability & capability score first
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // 3. Closer distance on tie
    return a.distanceKm - b.distanceKm;
  });
}

/**
 * scoreHospital()
 * ------------------------------------------------------------------------------
 * Evaluates an individual hospital across 4 key criteria:
 * Specialist on-duty, Available Beds, Hospital Readiness, and Proximity.
 */
function scoreHospital(
  emergencyType: string,
  needed: string[],
  lat: number,
  lng: number,
  hospital: HospitalInput,
): Recommendation {
  const distanceKm = haversineKm(lat, lng, hospital.latitude, hospital.longitude);
  const etaMinutes = estimateMinutes(distanceKm);

  // Find all specialists currently clocked in and available
  const availableSpecialists = hospital.doctors
    .filter((d) => d.availability?.isAvailable)
    .map((d) => d.specialization);

  const matchingSpecialists = needed.filter((spec) => availableSpecialists.includes(spec));
  const primaryNeeded = needed[0];
  const hasPrimary = availableSpecialists.includes(primaryNeeded);
  const beds = hospital.beds?.available ?? 0;
  const totalBeds = hospital.beds?.total ?? 0;
  const facilities = safeParseList(hospital.facilities);
  const ready = hospital.readinessStatus === "READY";
  const hasFacility = FACILITY_MAP[emergencyType]?.(hospital) ?? true;

  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Specialist Doctor Scoring (Up to +40 points)
  if (hasPrimary) {
    score += 40;
    reasons.push(`Required specialist available (${pretty(primaryNeeded)})`);
  } else if (matchingSpecialists.length) {
    score += 22;
    reasons.push(`Supporting specialist available (${matchingSpecialists.map(pretty).join(", ")})`);
    warnings.push(`Primary specialist ${pretty(primaryNeeded)} is not currently listed as available`);
  } else {
    warnings.push("No matching specialist currently marked available (DEMO DATA)");
  }

  // 2. Bed Availability Scoring (Up to +25 points)
  if (beds > 0) {
    const bedScore = Math.min(25, 10 + beds * 3);
    score += bedScore;
    reasons.push(`${beds} emergency bed${beds === 1 ? "" : "s"} available`);
  } else {
    warnings.push("No emergency beds currently available (DEMO DATA)");
  }

  // 3. Hospital Readiness Status (Up to +15 points)
  if (ready) {
    score += 15;
    reasons.push("Hospital marked READY for incoming emergencies");
  } else {
    warnings.push(`Hospital readiness is ${hospital.readinessStatus}`);
  }

  // 4. Distance & Proximity Scoring (Up to +35 points, or negative penalty for cross-city facilities)
  let distanceScore = 0;
  if (distanceKm <= 3) {
    distanceScore = 35;
    reasons.push(`Immediate proximity (${distanceKm.toFixed(1)} km · ETA ${etaMinutes} min)`);
  } else if (distanceKm <= 8) {
    distanceScore = 28 - (distanceKm - 3) * 1.5;
    reasons.push(`Nearby facility (${distanceKm.toFixed(1)} km · ETA ${etaMinutes} min)`);
  } else if (distanceKm <= 20) {
    distanceScore = 20 - (distanceKm - 8) * 0.8;
    reasons.push(`${distanceKm.toFixed(1)} km away · ETA about ${etaMinutes} min`);
  } else if (distanceKm <= 40) {
    distanceScore = Math.max(0, 10 - (distanceKm - 20) * 0.4);
    reasons.push(`${distanceKm.toFixed(1)} km away · ETA about ${etaMinutes} min`);
  } else {
    // Cross-city distance penalty: Ensure hospitals 100+ km away don't get selected for local emergencies
    distanceScore = -Math.min(150, 40 + (distanceKm - 40) * 2);
    warnings.push(
      `Distant facility in another district (${distanceKm.toFixed(0)} km away · ETA ~${etaMinutes} mins). Not recommended for immediate local emergency.`
    );
  }
  score += distanceScore;

  // 5. Specialized Facility Check (+5 points)
  if (hasFacility) {
    score += 5;
    reasons.push("Required emergency facility capability is present");
  } else {
    warnings.push("Preferred facility capability is not listed");
  }

  // A hospital is considered clinically suitable if it has the required specialist, open beds, is ready, and is local
  const suitable = hasPrimary && beds > 0 && ready && distanceKm <= 45;

  return {
    hospitalId: hospital.id,
    name: hospital.name,
    city: hospital.city || (distanceKm > 50 ? "Other City" : "Local"),
    distanceKm: Number(distanceKm.toFixed(2)),
    etaMinutes,
    score: Math.round(score),
    reasons,
    warnings,
    availableSpecialists: [...new Set(availableSpecialists)],
    availableBeds: beds,
    totalBeds,
    facilities,
    readinessStatus: hospital.readinessStatus,
    suitable,
    latitude: hospital.latitude,
    longitude: hospital.longitude,
  };
}

/** Formats an internal identifier (e.g. "CARDIOLOGIST") into pretty title case ("Cardiologist") */
function pretty(code: string) {
  return code
    .toLowerCase()
    .split("_")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

/** Safely parses a JSON list of facilities, falling back to comma-separated strings */
function safeParseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value ? value.split(",").map((s) => s.trim()) : [];
  }
}
