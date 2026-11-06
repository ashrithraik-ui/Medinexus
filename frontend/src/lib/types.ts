export type Role = "ADMIN" | "AMBULANCE_DRIVER" | "HOSPITAL_STAFF" | "TRAFFIC_CONTROL";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  hospitalId?: string | null;
  ambulanceId?: string | null;
  hospital?: { id: string; name: string; readinessStatus: string } | null;
  ambulance?: {
    id: string;
    vehicleCode: string;
    status: string;
    currentLat: number | null;
    currentLng: number | null;
  } | null;
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

export type Emergency = {
  id: string;
  type: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress?: string | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  greenCorridorActive: boolean;
  hospitalId?: string | null;
  hospitalReadinessNote?: string | null;
  createdAt: string;
  ambulance?: { id: string; vehicleCode: string; userId?: string };
  driverName?: string | null;
  driverPhone?: string | null;
  requiredSpecialist?: string | null;
  patientCondition?: string | null;
  hospital?: { id: string; name: string; latitude: number; longitude: number } | null;
  patient?: {
    id: string;
    displayName: string;
    age: number | null;
    gender: string | null;
    notes: string | null;
    emergencyType: string;
  };
  route?: [number, number][];
  recommendations?: Recommendation[];
  history?: {
    id: string;
    summary: string;
    timeline: string;
    createdAt: string;
  } | null;
};

export type Signal = {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  mode: string;
  sequenceOrder: number;
  isDemoData: boolean;
};

export type CorridorState = {
  emergencyId: string;
  corridorActive: boolean;
  activeSignal: { id: string; code: string; name: string; status: string; mode: string; distanceMeters?: number } | null;
  nextSignal: { id: string; code: string; name: string; distanceMeters?: number } | null;
  signals: Signal[];
  demo: boolean;
  safetyNote?: string;
};

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
