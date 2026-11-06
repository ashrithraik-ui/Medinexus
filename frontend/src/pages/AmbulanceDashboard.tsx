import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Baby,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Edit3,
  Heart,
  Hospital,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  Target,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { CorridorState, Emergency, Recommendation, Signal } from "../lib/types";
import { MapView } from "../components/MapView";
import { Toast } from "../components/Toast";
import { LiveClock, calculateEtaAmPm } from "../components/LiveClock";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import {
  searchLocalLocations,
  resolveLocationCoords,
  reverseLookupCoords,
  type GeoLocationItem,
  KARNATAKA_LOCATIONS,
} from "../lib/locationDirectory";

const DEMO_PICKUP: [number, number] = [12.9352, 77.6245]; // Bangalore (Koramangala 5th Block)

type EmergencyCaseType = "ROAD_ACCIDENT" | "HEART_ATTACK" | "PREGNANCY" | "OTHER" | "MANUAL";

interface CaseOption {
  type: EmergencyCaseType;
  title: string;
  neededSpecialist: string;
  icon: typeof AlertTriangle;
  accentColor: string;
}

const CASE_OPTIONS: CaseOption[] = [
  {
    type: "ROAD_ACCIDENT",
    title: "Road Accident",
    neededSpecialist: "Orthopedic Surgeon & Trauma",
    icon: AlertTriangle,
    accentColor: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    type: "HEART_ATTACK",
    title: "Heart Attack",
    neededSpecialist: "Cardiologist & Cath Lab",
    icon: Heart,
    accentColor: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    type: "PREGNANCY",
    title: "Delivery / Pregnancy",
    neededSpecialist: "Gynecologist & Obstetrician",
    icon: Baby,
    accentColor: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    type: "OTHER",
    title: "Other Critical Emergency",
    neededSpecialist: "Emergency Medicine Specialist",
    icon: Activity,
    accentColor: "text-sky-600 bg-sky-50 border-sky-200",
  },
];

const PRESET_LANDMARKS = [
  { name: "Koramangala 5th Block", coords: [12.9352, 77.6245] as [number, number] },
  { name: "Indiranagar 100ft Road", coords: [12.9719, 77.6412] as [number, number] },
  { name: "MG Road / Trinity Circle", coords: [12.9756, 77.6066] as [number, number] },
  { name: "HSR Layout BDA Complex", coords: [12.9116, 77.6389] as [number, number] },
  { name: "Bannerghatta Road / IIM-B", coords: [12.8950, 77.5980] as [number, number] },
  { name: "Whitefield ITPL", coords: [12.9863, 77.7370] as [number, number] },
  { name: "Hebbal Flyover", coords: [13.0358, 77.5970] as [number, number] },
  { name: "Electronic City Phase 1", coords: [12.8452, 77.6602] as [number, number] },
  { name: "Jayanagar 4th Block", coords: [12.9298, 77.5838] as [number, number] },
  { name: "Victoria Hospital / KR Market", coords: [12.9629, 77.5746] as [number, number] },
  { name: "Mysore Palace North Gate", coords: [12.3054, 76.6551] as [number, number] },
  { name: "K.R. Circle Mysore", coords: [12.3101, 76.6518] as [number, number] },
];

export function AmbulanceDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Workflow steps: 1 = Condition, 2 = Location, 3 = Nearest Hospitals, 4 = Route & Signals
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCase, setSelectedCase] = useState<EmergencyCaseType | null>(null);

  // Manual Condition State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualSpecialist, setManualSpecialist] = useState("EMERGENCY_MEDICINE");

  // Location State
  const [coords, setCoords] = useState<[number, number]>(DEMO_PICKUP);
  const [locationName, setLocationName] = useState("Bangalore Live GPS");
  const [liveGpsCoords, setLiveGpsCoords] = useState<[number, number] | null>(null);
  const [manualLocationText, setManualLocationText] = useState("Koramangala 5th Block, Bangalore");
  const [locationMode, setLocationMode] = useState<"LIVE_GPS" | "MANUAL">("LIVE_GPS");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [manualSuggestions, setManualSuggestions] = useState<GeoLocationItem[]>([]);
  const [landmarkCityFilter, setLandmarkCityFilter] = useState<"ALL" | "BANGALORE" | "MYSORE">("ALL");
  const [hospitalCityTab, setHospitalCityTab] = useState<"ALL" | "BANGALORE" | "MYSORE">("ALL");

  // Acquire Real Live GPS from Browser Geolocation (with Network IP Fallback)
  function acquireLiveGpsLocation() {
    setLocationMode("LIVE_GPS");
    setGpsError("");
    setGpsLoading(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const detected: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setLiveGpsCoords(detected);
          setCoords(detected);
          const lookup = reverseLookupCoords(detected[0], detected[1]);
          const regionLabel =
            lookup.city === "Bangalore"
              ? "Bangalore Live GPS"
              : lookup.city === "Mysore"
              ? "Mysore Live GPS"
              : "Live GPS Location";
          setLocationName(`${regionLabel} (${detected[0].toFixed(4)}, ${detected[1].toFixed(4)})`);
          setManualLocationText(lookup.name);
          setGpsLoading(false);
        },
        async (err) => {
          console.warn("GPS notice, attempting network location lookup...", err);
          try {
            const res = await fetch("https://ipwho.is/");
            const data = await res.json();
            if (data && data.success && typeof data.latitude === "number") {
              const detected: [number, number] = [data.latitude, data.longitude];
              setLiveGpsCoords(detected);
              setCoords(detected);
              const lookup = reverseLookupCoords(detected[0], detected[1]);
              const city = data.city || lookup.city || "Bangalore";
              setLocationName(`${city} (Network Location: ${detected[0].toFixed(4)}, ${detected[1].toFixed(4)})`);
              setManualLocationText(lookup.name);
              setGpsLoading(false);
              return;
            }
          } catch {
            // ignore network fallback error
          }

          // Safe fallback to Bangalore center
          setCoords(DEMO_PICKUP);
          setLocationName("Bangalore (Koramangala 5th Block)");
          setManualLocationText("Koramangala 5th Block, Bangalore");
          let msg =
            "Could not fetch GPS automatically. Location pinned to Bangalore. Click anywhere on the map to set your pin.";
          if (err.code === 1) {
            msg =
              "Browser location permission was not granted. Pinned to Bangalore. Click anywhere on the map to place your pin.";
          }
          setGpsError(msg);
          setGpsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        }
      );
    } else {
      setGpsError("Geolocation is not supported by this browser. Click on the map to place your pin.");
      setGpsLoading(false);
    }
  }

  // Handle Map Pin Click (Click anywhere on the map to place pickup location)
  function handleMapPinClick(pickedCoords: [number, number]) {
    setCoords(pickedCoords);
    const lookup = reverseLookupCoords(pickedCoords[0], pickedCoords[1]);
    const label = `${lookup.name} (${pickedCoords[0].toFixed(4)}, ${pickedCoords[1].toFixed(4)})`;
    setManualLocationText(lookup.name);
    setLocationName(label);
    setLocationMode("MANUAL");
    setManualSuggestions([]);
  }

  // Select Manual Location Mode
  async function selectManualMode() {
    setLocationMode("MANUAL");
    setGpsError("");
    const initialText = manualLocationText.trim() || "Koramangala 5th Block, Bangalore";
    setManualLocationText(initialText);
    const resolved = await resolveLocationCoords(initialText);
    setCoords(resolved.coords);
    setLocationName(resolved.displayName);
    setManualSuggestions([]);
  }

  // Handle Manual Typing (Street/Area, City, or Coordinates)
  async function handleManualInputChange(val: string) {
    setManualLocationText(val);

    if (!val.trim()) {
      setManualSuggestions([]);
      return;
    }

    // 1. Direct Coordinates (e.g. "12.9716, 77.5946")
    const coordMatch = val.match(/^([0-9.-]+)[\s,]+([0-9.-]+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setCoords([lat, lng]);
        const isBlr = lat >= 12.75 && lat <= 13.25 && lng >= 77.35 && lng <= 77.85;
        const isMyq = lat >= 12.2 && lat <= 12.45 && lng >= 76.5 && lng <= 76.8;
        const cityName = isBlr ? "Bangalore" : isMyq ? "Mysore" : "Coordinates";
        setLocationName(`${cityName} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        setManualSuggestions([]);
        return;
      }
    }

    // 2. Instant matching against Karnataka directory
    const suggestions = searchLocalLocations(val, 6);
    setManualSuggestions(suggestions);

    // If query matches a known place or city, update coordinates immediately
    const clean = val.toLowerCase().trim();
    const exactMatch = KARNATAKA_LOCATIONS.find(
      (loc) =>
        loc.name.toLowerCase() === clean ||
        loc.city.toLowerCase() === clean ||
        loc.aliases.some((a) => a === clean)
    );
    if (exactMatch) {
      setCoords(exactMatch.coords);
      setLocationName(`${exactMatch.name}, ${exactMatch.city}`);
    } else if (suggestions.length > 0 && clean.length >= 3) {
      // Set coords to top candidate
      setCoords(suggestions[0].coords);
      setLocationName(`${suggestions[0].name}, ${suggestions[0].city}`);
    }
  }

  // Select Autocomplete Suggestion
  function selectSuggestion(item: GeoLocationItem) {
    setManualLocationText(item.name);
    setLocationName(`${item.name}, ${item.city}`);
    setCoords(item.coords);
    setManualSuggestions([]);
  }

  // Fetch Current Device GPS into Manual Entry
  function fetchGpsIntoManual() {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detected: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCoords(detected);
        setLiveGpsCoords(detected);
        const isBlr = detected[0] >= 12.75 && detected[0] <= 13.25 && detected[1] >= 77.35 && detected[1] <= 77.85;
        const isMyq = detected[0] >= 12.2 && detected[0] <= 12.45 && detected[1] >= 76.5 && detected[1] <= 76.8;
        const city = isBlr ? "Bangalore" : isMyq ? "Mysore" : "Current Location";
        const label = `${city} Live GPS (${detected[0].toFixed(4)}, ${detected[1].toFixed(4)})`;
        setManualLocationText(label);
        setLocationName(label);
        setManualSuggestions([]);
        setGpsLoading(false);
      },
      (err) => {
        console.warn("GPS error:", err);
        setGpsError("Could not fetch GPS. Please type an address or pick a landmark.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Select Quick Landmark
  function selectLandmark(lm: (typeof PRESET_LANDMARKS)[number]) {
    setManualLocationText(lm.name);
    setLocationName(lm.name);
    setCoords(lm.coords);
    setManualSuggestions([]);
  }

  // Hospital & Doctor Data
  const [allHospitals, setAllHospitals] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Recommendation | null>(null);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  // Active Emergency, Route & Signals
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);

  // Simulation State
  const [simulating, setSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(45);
  const [transitProgress, setTransitProgress] = useState(0);
  const [activePrioritySignal, setActivePrioritySignal] = useState<{ id: string; code: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const indexRef = useRef(0);
  const isPausedRef = useRef(false);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initial Load: Fetch Hospitals & Signals, Detect Geolocation
  useEffect(() => {
    api<{ hospitals: any[] }>("/hospitals")
      .then((d) => setAllHospitals(d.hospitals))
      .catch(() => {});

    api<{ signals: Signal[] }>("/traffic/signals")
      .then((d) => setSignals(d.signals))
      .catch(() => {});

    // Try detecting live real GPS immediately on startup
    acquireLiveGpsLocation();
  }, []);

  // 2. Real-time Socket.IO Listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onDecision = (p: { accepted: boolean; status: string; note?: string }) => {
      setEmergency((e) => (e ? { ...e, status: p.status } : e));
      setToast({
        title: p.accepted ? "Hospital Accepted Intake" : "Hospital Update",
        body: p.note || (p.accepted ? "Trauma and surgical team on standby." : "Hospital acknowledged request."),
      });
    };

    const onCorridor = (p: CorridorState) => {
      if (p.signals) setSignals(p.signals);
      if (p.activeSignal) {
        setActivePrioritySignal({ id: p.activeSignal.id, code: p.activeSignal.code, name: p.activeSignal.name });
      } else {
        setActivePrioritySignal(null);
      }
    };

    const onTrafficSignals = (p: { signals: Signal[] }) => {
      if (p.signals) {
        setSignals((prev) => {
          return p.signals.map((s) => {
            const existing = prev.find((x) => x.id === s.id);
            if (existing && existing.mode === "EMERGENCY_PRIORITY") {
              return { ...s, mode: "EMERGENCY_PRIORITY", status: "GREEN" };
            }
            return s;
          });
        });
      }
    };

    socket.on("emergency:decision", onDecision);
    socket.on("corridor:update", onCorridor);
    socket.on("traffic:signals", onTrafficSignals);

    return () => {
      socket.off("emergency:decision", onDecision);
      socket.off("corridor:update", onCorridor);
      socket.off("traffic:signals", onTrafficSignals);
    };
  }, []);

  // Continuous real-world traffic light cycle for normal intersections
  useEffect(() => {
    const cycleInterval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setSignals((prev) =>
        prev.map((s) => {
          // If ambulance is approaching this signal, KEEP SOLID GREEN!
          if (s.mode === "EMERGENCY_PRIORITY") {
            return { ...s, status: "GREEN" };
          }
          // Real-world cycle: RED (8s) -> GREEN (7s) -> YELLOW (3s) -> RED
          const offset = (s.sequenceOrder * 5) % 18;
          const phase = (now + offset) % 18;
          const nextStatus = phase < 8 ? "RED" : phase < 15 ? "GREEN" : "YELLOW";
          return { ...s, status: nextStatus };
        })
      );
    }, 2000);

    return () => clearInterval(cycleInterval);
  }, []);

  // 3. Action: Select Preset Condition -> Advance to Location Step
  function handleSelectPreset(caseType: EmergencyCaseType) {
    setSelectedCase(caseType);
    setCurrentStep(2);
  }

  // 4. Action: Save Manual Condition -> Advance to Location Step
  function handleSaveManualCondition() {
    if (!manualTitle.trim()) return;
    setSelectedCase("MANUAL");
    setIsManualModalOpen(false);
    setCurrentStep(2);
  }

  // 5. Action: Confirm Location -> Fetch Nearest Hospitals & Suggestions
  async function handleConfirmLocation() {
    setLoadingHospitals(true);
    setCurrentStep(3);

    let activeCoords = coords;
    if (locationMode === "MANUAL") {
      const resolved = await resolveLocationCoords(manualLocationText);
      activeCoords = resolved.coords;
      setCoords(resolved.coords);
      setLocationName(resolved.displayName);
      setManualSuggestions([]);
    }

    const typeForApi = selectedCase === "MANUAL" ? "OTHER" : selectedCase || "OTHER";

    try {
      const data = await api<{ recommendations: Recommendation[]; noneSuitable: boolean }>(
        "/hospitals/recommend",
        {
          method: "POST",
          body: JSON.stringify({
            emergencyType: typeForApi,
            latitude: activeCoords[0],
            longitude: activeCoords[1],
          }),
        }
      );
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error("Could not fetch recommendations", err);
    } finally {
      setLoadingHospitals(false);
    }
  }

  // 6. Action: Select Hospital -> Open Main Route Map with Signals
  async function handleSelectHospital(hospital: Recommendation) {
    setSelectedHospital(hospital);
    setLoadingHospitals(true);

    const caseTitle = selectedCase === "MANUAL" ? manualTitle : CASE_OPTIONS.find((c) => c.type === selectedCase)?.title || "Critical Case";
    const typeForApi = selectedCase === "MANUAL" ? "OTHER" : selectedCase || "OTHER";

    try {
      const res = await api<{ emergency: Emergency }>("/emergencies", {
        method: "POST",
        body: JSON.stringify({
          emergencyType: typeForApi,
          displayName: `Emergency Patient (${caseTitle})`,
          age: 35,
          gender: "Not specified",
          notes: `${caseTitle} at ${
            locationMode === "LIVE_GPS"
              ? `Real Live GPS (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`
              : manualLocationText || locationName
          }. Priority dispatch requested.`,
          latitude: coords[0],
          longitude: coords[1],
          pickupAddress:
            locationMode === "LIVE_GPS"
              ? `Real Live GPS (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`
              : manualLocationText || locationName,
        }),
      });

      const em = res.emergency;
      setEmergency(em);

      const routeRes = await api<{ emergency: Emergency; route: [number, number][] }>(
        `/emergencies/${em.id}/select-hospital`,
        {
          method: "POST",
          body: JSON.stringify({ hospitalId: hospital.hospitalId }),
        }
      );

      setEmergency(routeRes.emergency);
      setRoute(routeRes.route || []);

      const sigData = await api<{ signals: Signal[] }>("/traffic/signals");
      setSignals(sigData.signals || []);

      getSocket()?.emit("ops:subscribe", em.id);
      setCurrentStep(4);
    } catch (err) {
      console.error("Error setting hospital route", err);
      setRoute([coords, [hospital.latitude, hospital.longitude]]);
      setCurrentStep(4);
    } finally {
      setLoadingHospitals(false);
    }
  }

  // 7. Route Simulation Controls
  async function startSimulation() {
    if (!emergency || !route.length) return;
    setSimulating(true);
    setIsPaused(false);
    isPausedRef.current = false;
    indexRef.current = 0;

    await api(`/emergencies/${emergency.id}/start-transit`, { method: "POST" }).catch(() => {});
    setEmergency((e) => (e ? { ...e, status: "EN_ROUTE" } : e));

    runSimulationTick();
  }

  function pauseSimulation() {
    setIsPaused(true);
    isPausedRef.current = true;
    if (simTimerRef.current) {
      clearTimeout(simTimerRef.current);
      simTimerRef.current = null;
    }
  }

  function resumeSimulation() {
    if (!simulating || !emergency) return;
    setIsPaused(false);
    isPausedRef.current = false;
    runSimulationTick();
  }

  function handleToggleSimulation() {
    if (!simulating) {
      startSimulation();
    } else if (isPaused) {
      resumeSimulation();
    } else {
      pauseSimulation();
    }
  }

  async function resetSimulation() {
    if (simTimerRef.current) {
      clearTimeout(simTimerRef.current);
      simTimerRef.current = null;
    }
    setSimulating(false);
    setIsPaused(false);
    isPausedRef.current = false;
    indexRef.current = 0;
    setTransitProgress(0);
    setActivePrioritySignal(null);

    if (route.length > 0) {
      setCoords(route[0]);
    }

    if (emergency) {
      await api(`/emergencies/${emergency.id}/reset`, { method: "POST" }).catch(() => {});
      setEmergency((e) => (e ? { ...e, status: "ACCEPTED", greenCorridorActive: false } : e));
    }

    const sigData = await api<{ signals: Signal[] }>("/traffic/signals").catch(() => null);
    if (sigData?.signals) {
      setSignals(sigData.signals);
    }

    setToast({
      title: "Simulation Reset",
      body: "Ambulance returned to start point. Traffic signals restored to normal operation.",
    });
  }

  function runSimulationTick() {
    if (simTimerRef.current) {
      clearTimeout(simTimerRef.current);
    }

    const tick = async () => {
      if (isPausedRef.current) return;
      const i = indexRef.current;
      if (!route[i] || !emergency) return;

      const [lat, lng] = route[i];
      setCoords([lat, lng]);
      const progress = Math.round((i / (route.length - 1)) * 100);
      setTransitProgress(progress);
      setSpeedKmh(Math.floor(42 + Math.random() * 6));

      const arrived = i >= route.length - 1;
      await api("/ambulances/location", {
        method: "POST",
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          emergencyId: emergency.id,
          speedKmh: 45,
          arrived,
        }),
      }).catch(() => {});

      if (arrived) {
        await api(`/emergencies/${emergency.id}/arrive`, { method: "POST" }).catch(() => {});
        setEmergency((e) => (e ? { ...e, status: "ARRIVED", greenCorridorActive: false } : e));
        setSimulating(false);
        setIsPaused(false);
        setActivePrioritySignal(null);
        setToast({
          title: "ARRIVED AT HOSPITAL",
          body: `Transferred to ${selectedHospital?.name}. Route completed and signals released.`,
        });
        return;
      }

      indexRef.current += 1;
      simTimerRef.current = setTimeout(tick, 900);
    };

    tick();
  }

  // Helper: Return active case title
  function getActiveCaseTitle() {
    if (selectedCase === "MANUAL") return manualTitle || "Manual Condition";
    return CASE_OPTIONS.find((c) => c.type === selectedCase)?.title || "Condition";
  }

  // Helper: Get specialized on-duty doctors
  function getHospitalSpecialistDoctors(hospitalId: string) {
    const rawHospital = allHospitals.find((h) => h.id === hospitalId);
    if (!rawHospital || !rawHospital.doctors) return [];

    let targetSpecializations: string[] = [];
    if (selectedCase === "ROAD_ACCIDENT") {
      targetSpecializations = ["ORTHOPEDIC", "EMERGENCY_MEDICINE"];
    } else if (selectedCase === "HEART_ATTACK") {
      targetSpecializations = ["CARDIOLOGIST", "EMERGENCY_MEDICINE"];
    } else if (selectedCase === "PREGNANCY") {
      targetSpecializations = ["GYNECOLOGIST", "EMERGENCY_MEDICINE"];
    } else if (selectedCase === "MANUAL") {
      targetSpecializations = [manualSpecialist, "EMERGENCY_MEDICINE"];
    } else {
      targetSpecializations = ["GENERAL_PHYSICIAN", "EMERGENCY_MEDICINE"];
    }

    return rawHospital.doctors.filter(
      (doc: any) =>
        targetSpecializations.includes(doc.specialization) &&
        (doc.availability?.isAvailable ?? true)
    );
  }

  // Identify and order traffic signals along the selected route
  const routeSignals = signals
    .filter((s) => {
      if (!route || route.length < 2) return false;
      return route.some(([rLat, rLng]) => {
        return Math.abs(s.latitude - rLat) < 0.009 && Math.abs(s.longitude - rLng) < 0.009;
      });
    })
    .sort((a, b) => {
      let minA = Infinity;
      let idxA = 0;
      let minB = Infinity;
      let idxB = 0;
      for (let i = 0; i < route.length; i++) {
        const dA = (a.latitude - route[i][0]) ** 2 + (a.longitude - route[i][1]) ** 2;
        if (dA < minA) {
          minA = dA;
          idxA = i;
        }
        const dB = (b.latitude - route[i][0]) ** 2 + (b.longitude - route[i][1]) ** 2;
        if (dB < minB) {
          minB = dB;
          idxB = i;
        }
      }
      return idxA - idxB;
    });

  const displayedSignals = routeSignals.length > 0 ? routeSignals : signals.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-16">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white font-bold text-sm shadow-sm">
              <Activity size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 tracking-tight">
                  LIFELINE 360
                </span>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Ambulance {user?.ambulance?.vehicleCode || "KA-09-G-3601"} · {user?.name || "Ambulance Driver"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-time Live Clock with AM/PM */}
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <Clock size={13} className="text-sky-600" />
              <LiveClock showSeconds={true} />
            </div>

            <a
              href="/hospital"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition"
              title="Open Hospital Management Dashboard"
            >
              <Hospital size={13} />
              <span>Hospital Desk</span>
            </a>

            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* 4-Step Stepper */}
        <div className="bg-slate-100/70 border-t border-slate-200/70 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between text-xs font-semibold">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-md transition ${
                currentStep === 1
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>1. Condition</span>
            </button>

            <span className="text-slate-300">/</span>

            <button
              disabled={!selectedCase}
              onClick={() => selectedCase && setCurrentStep(2)}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-md transition ${
                currentStep === 2
                  ? "bg-sky-600 text-white shadow-sm"
                  : selectedCase
                  ? "text-slate-600 hover:bg-slate-200"
                  : "text-slate-400 cursor-not-allowed"
              }`}
            >
              <span>2. Location</span>
            </button>

            <span className="text-slate-300">/</span>

            <button
              disabled={!recommendations.length && currentStep < 3}
              onClick={() => recommendations.length && setCurrentStep(3)}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-md transition ${
                currentStep === 3
                  ? "bg-sky-600 text-white shadow-sm"
                  : recommendations.length
                  ? "text-slate-600 hover:bg-slate-200"
                  : "text-slate-400 cursor-not-allowed"
              }`}
            >
              <span>3. Hospitals</span>
            </button>

            <span className="text-slate-300">/</span>

            <button
              disabled={!selectedHospital}
              onClick={() => selectedHospital && setCurrentStep(4)}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-md transition ${
                currentStep === 4
                  ? "bg-sky-600 text-white shadow-sm"
                  : selectedHospital
                  ? "text-slate-600 hover:bg-slate-200"
                  : "text-slate-400 cursor-not-allowed"
              }`}
            >
              <span>4. Route & Signals</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
        {/* ========================================================================= */}
        {/* STEP 1: SELECT CONDITION (PRESET OR MANUAL ENTRY)                         */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Select Patient Condition
                </h1>
                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg transition"
                >
                  <Plus size={14} />
                  <span>Add Manual Condition</span>
                </button>
              </div>

              {/* 4 Preset Option Cards */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {CASE_OPTIONS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.type}
                      onClick={() => handleSelectPreset(c.type)}
                      className={`cursor-pointer rounded-xl border-2 p-4 transition-all bg-white hover:bg-slate-50 shadow-sm hover:shadow ${
                        selectedCase === c.type
                          ? "border-sky-600 ring-2 ring-sky-100"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg border ${c.accentColor}`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">{c.title}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Specialist: <strong className="text-slate-700">{c.neededSpecialist}</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Condition Card (if already entered) */}
              {selectedCase === "MANUAL" && manualTitle && (
                <div
                  onClick={() => setCurrentStep(2)}
                  className="mt-3 cursor-pointer rounded-xl border-2 border-sky-600 bg-sky-50/50 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg border border-sky-200 bg-sky-100 text-sky-700">
                        <Edit3 size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900">{manualTitle}</h3>
                          <span className="text-[10px] bg-sky-200 text-sky-800 px-2 py-0.2 rounded font-bold">Custom</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Specialist: <strong className="text-slate-700">{manualSpecialist.replace("_", " ")}</strong>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-sky-600 flex items-center gap-1">
                      Proceed ➔
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Manual Condition Dialog Modal */}
            {isManualModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-base text-slate-900">
                      Add Manual Condition
                    </h3>
                    <button
                      onClick={() => setIsManualModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4 space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Condition / Diagnosis
                      </label>
                      <input
                        type="text"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="e.g. Stroke / Brain Trauma, Severe Burns, Poisoning..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Required Specialist
                      </label>
                      <select
                        value={manualSpecialist}
                        onChange={(e) => setManualSpecialist(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="EMERGENCY_MEDICINE">Emergency Medicine Specialist</option>
                        <option value="CARDIOLOGIST">Cardiologist</option>
                        <option value="ORTHOPEDIC">Orthopedic Surgeon</option>
                        <option value="GYNECOLOGIST">Gynecologist / Obstetrician</option>
                        <option value="GENERAL_PHYSICIAN">General Physician / Surgeon</option>
                      </select>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setIsManualModalOpen(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!manualTitle.trim()}
                        onClick={handleSaveManualCondition}
                        className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow transition disabled:opacity-50"
                      >
                        Continue to Location
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: ASK FOR CURRENT LOCATION (LIVE GPS OR MANUAL ENTRY)              */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <h1 className="text-base font-bold text-slate-900">
                    Confirm Ambulance Location
                  </h1>
                </div>
                <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
                  Condition: {getActiveCaseTitle()}
                </span>
              </div>

              {/* Location Mode Choice */}
              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                {/* Option 1: Live GPS */}
                <div
                  onClick={acquireLiveGpsLocation}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition ${
                    locationMode === "LIVE_GPS"
                      ? "border-sky-600 bg-sky-50/40 ring-2 ring-sky-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
                        <Compass size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900">Use Live GPS Location</h3>
                          {liveGpsCoords && (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                        </div>
                        {gpsLoading ? (
                          <p className="text-xs text-sky-600 font-medium flex items-center gap-1.5 mt-0.5">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Detecting real live GPS...</span>
                          </p>
                        ) : liveGpsCoords ? (
                          <p className="text-xs text-emerald-700 font-mono font-bold mt-0.5 flex items-center gap-1.5">
                            <span>{liveGpsCoords[0].toFixed(4)}, {liveGpsCoords[1].toFixed(4)}</span>
                            <span className="text-[10px] text-emerald-600 font-sans font-medium">(Real GPS Active)</span>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        acquireLiveGpsLocation();
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition"
                      title="Refresh Live GPS"
                    >
                      <RefreshCw size={14} className={gpsLoading ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                {/* Option 2: Manual Location Entry */}
                <div
                  onClick={selectManualMode}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition ${
                    locationMode === "MANUAL"
                      ? "border-sky-600 bg-sky-50/40 ring-2 ring-sky-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-sky-100 text-sky-700">
                      <MapPin size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-slate-900">Enter Location Manually</h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {locationMode === "MANUAL" ? manualLocationText || locationName : "Type address or select landmark"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* GPS Error Alert (if permission denied or timed out) */}
                {gpsError && locationMode === "LIVE_GPS" && (
                  <div className="col-span-1 sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                      <span>{gpsError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={acquireLiveGpsLocation}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 transition"
                    >
                      Retry GPS
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Location Input & Quick Landmark Selectors */}
              {locationMode === "MANUAL" && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Type Location, Locality or City (Bangalore / Mysore)
                      </label>
                      <button
                        type="button"
                        onClick={fetchGpsIntoManual}
                        className="inline-flex items-center gap-1.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 px-2.5 py-1 rounded-lg font-semibold transition border border-sky-200"
                        title="Acquire device GPS into manual input"
                      >
                        <Target size={13} className={gpsLoading ? "animate-spin" : ""} />
                        <span>{gpsLoading ? "Fetching GPS..." : "Fetch Current GPS"}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Search size={14} />
                      </span>
                      <input
                        type="text"
                        value={manualLocationText}
                        onChange={(e) => handleManualInputChange(e.target.value)}
                        placeholder="e.g. Bangalore, Koramangala, Indiranagar, Whitefield, Mysore Palace, or 12.935, 77.624..."
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                      />
                      {manualLocationText && (
                        <button
                          type="button"
                          onClick={() => {
                            setManualLocationText("");
                            setManualSuggestions([]);
                          }}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      )}

                      {/* Autocomplete Dropdown */}
                      {manualSuggestions.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                          <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Matching Karnataka Localities & Landmarks</span>
                            <button
                              type="button"
                              onClick={() => setManualSuggestions([])}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {manualSuggestions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => selectSuggestion(item)}
                              className="w-full text-left px-3.5 py-2.5 hover:bg-sky-50 transition flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <MapPin size={14} className="text-sky-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                                  <p className="text-[11px] text-slate-500">{item.city}, {item.state}</p>
                                </div>
                              </div>
                              <span className="shrink-0 text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                {item.coords[0].toFixed(4)}, {item.coords[1].toFixed(4)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Common Landmark Selectors with City Tabs */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Common Landmarks Quick-Select:
                      </p>
                      <div className="flex items-center gap-1 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setLandmarkCityFilter("ALL")}
                          className={`px-2 py-0.5 rounded transition ${
                            landmarkCityFilter === "ALL"
                              ? "bg-slate-800 text-white font-bold"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          All ({PRESET_LANDMARKS.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setLandmarkCityFilter("BANGALORE")}
                          className={`px-2 py-0.5 rounded transition ${
                            landmarkCityFilter === "BANGALORE"
                              ? "bg-sky-600 text-white font-bold"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          Bangalore
                        </button>
                        <button
                          type="button"
                          onClick={() => setLandmarkCityFilter("MYSORE")}
                          className={`px-2 py-0.5 rounded transition ${
                            landmarkCityFilter === "MYSORE"
                              ? "bg-purple-600 text-white font-bold"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          Mysore
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {PRESET_LANDMARKS.filter((lm) => {
                        const isMysore = lm.name.toLowerCase().includes("mysore");
                        if (landmarkCityFilter === "BANGALORE") return !isMysore;
                        if (landmarkCityFilter === "MYSORE") return isMysore;
                        return true;
                      }).map((lm) => {
                        const isSelected =
                          manualLocationText.toLowerCase() === lm.name.toLowerCase() ||
                          (coords[0] === lm.coords[0] && coords[1] === lm.coords[1]);

                        return (
                          <button
                            key={lm.name}
                            type="button"
                            onClick={() => selectLandmark(lm)}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-sky-600 text-white border-sky-600 shadow-sm font-bold"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                            }`}
                          >
                            <MapPin size={12} className={isSelected ? "text-white" : "text-slate-400"} />
                            <span>{lm.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Target Info Card */}
                  <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-3 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-slate-500 text-[11px] block">Active Target:</span>
                        <strong className="text-slate-900 font-bold">{manualLocationText || locationName}</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Coordinates</span>
                      <span className="font-mono text-sky-800 font-bold">{coords[0].toFixed(4)}, {coords[1].toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Location Map with Live Pin & Locate-Me Button */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between pb-2 px-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <MapPin size={14} className="text-sky-600" />
                    <span>Live Location & Pickup Pin</span>
                    <span className="text-slate-300 font-normal">·</span>
                    <span className="text-slate-500 font-medium text-[11px]">
                      {locationMode === "LIVE_GPS" ? "Live GPS Active" : "Manual Pin Mode"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-lg font-bold">
                      {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <MapView
                    center={coords}
                    zoom={14}
                    pickupLocation={{
                      lat: coords[0],
                      lng: coords[1],
                      label: manualLocationText || locationName,
                    }}
                    onLocationPick={handleMapPinClick}
                    showLocateButton={true}
                    onLocateMe={acquireLiveGpsLocation}
                    isLocating={gpsLoading}
                    className="h-[300px] sm:h-[360px] w-full"
                    theme="light"
                  />
                </div>
              </div>

              {/* Proceed Button */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-500">Confirmed Location:</span>
                  <strong className="text-slate-900 font-bold">
                    {locationMode === "LIVE_GPS"
                      ? liveGpsCoords
                        ? `Real Live GPS (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`
                        : "Detecting Real Live GPS..."
                      : manualLocationText || locationName}
                  </strong>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">
                    Time: <LiveClock showSeconds={false} className="font-mono font-bold text-slate-800" />
                  </span>
                </div>

                <button
                  onClick={handleConfirmLocation}
                  className="inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow hover:shadow-md transition"
                >
                  <span>Find Nearest Hospitals</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: PRIORITY-WISE NEAREST HOSPITALS & AVAILABLE DOCTORS               */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {/* Top Bar for Step 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  title="Change Location"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Condition: {getActiveCaseTitle()}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Location:{" "}
                    <strong className="text-slate-700">
                      {locationMode === "LIVE_GPS"
                        ? liveGpsCoords
                          ? `Real Live GPS (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`
                          : "Real Live GPS"
                        : manualLocationText || locationName}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-semibold text-slate-600 hover:underline"
                >
                  Change Location
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-semibold text-sky-600 hover:underline"
                >
                  Change Condition
                </button>
              </div>
            </div>

            {/* Section Heading & City Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Nearest Hospitals (Priority Ranked)
                </h2>
                <p className="text-xs text-slate-500">
                  Target: <strong className="text-slate-800">{manualLocationText || locationName}</strong> · Closest local emergency centers prioritized
                </p>
              </div>

              {/* City Filter Pills */}
              <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setHospitalCityTab("ALL")}
                  className={`px-3 py-1 rounded-lg transition ${
                    hospitalCityTab === "ALL"
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({recommendations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHospitalCityTab("BANGALORE")}
                  className={`px-3 py-1 rounded-lg transition ${
                    hospitalCityTab === "BANGALORE"
                      ? "bg-sky-600 text-white shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Bangalore ({recommendations.filter((h) => h.city === "Bangalore" || (coords[0] >= 12.7 && h.distanceKm <= 50)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setHospitalCityTab("MYSORE")}
                  className={`px-3 py-1 rounded-lg transition ${
                    hospitalCityTab === "MYSORE"
                      ? "bg-purple-600 text-white shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Mysore ({recommendations.filter((h) => h.city === "Mysore" || (coords[0] < 12.5 && h.distanceKm <= 50)).length})
                </button>
              </div>
            </div>

            {loadingHospitals && (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-r-transparent mb-2" />
                <p className="text-xs font-semibold text-slate-700">Loading hospitals & doctors...</p>
              </div>
            )}

            {/* Priority Hospital Cards */}
            {!loadingHospitals && (
              <div className="space-y-3">
                {recommendations
                  .filter((hosp) => {
                    if (hospitalCityTab === "BANGALORE") {
                      return hosp.city === "Bangalore" || (coords[0] >= 12.7 && hosp.distanceKm <= 50);
                    }
                    if (hospitalCityTab === "MYSORE") {
                      return hosp.city === "Mysore" || (coords[0] < 12.5 && hosp.distanceKm <= 50);
                    }
                    return true;
                  })
                  .map((hosp, idx) => {
                  const doctors = getHospitalSpecialistDoctors(hosp.hospitalId);
                  const isTop = idx === 0;
                  const isDistant = hosp.distanceKm > 45;

                  return (
                    <div
                      key={hosp.hospitalId}
                      className={`bg-white rounded-xl border p-5 shadow-sm transition ${
                        isTop ? "border-emerald-400 ring-1 ring-emerald-100" : isDistant ? "border-amber-200 bg-amber-50/10" : "border-slate-200"
                      }`}
                    >
                      {/* Priority Rank & Distance Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded px-2 py-0.5 font-bold ${
                              isTop
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isTop ? "Priority 1 (Recommended)" : `Priority ${idx + 1}`}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-semibold text-slate-600">
                            {hosp.readinessStatus === "READY" ? "ER Ready" : "Limited Capacity"}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {hosp.city || (isDistant ? "Other City" : "Local")}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 font-semibold">
                          {isDistant ? (
                            <span className="text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[11px] font-bold">
                              Distant ({hosp.distanceKm.toFixed(0)} km away)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold">
                              <Navigation size={12} className="text-sky-600" />
                              <span>{hosp.distanceKm.toFixed(1)} km</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-sky-700 font-mono text-[11px]">
                            <Clock size={12} />
                            <span>~{hosp.etaMinutes} mins (ETA {calculateEtaAmPm(hosp.etaMinutes)})</span>
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mt-3.5 grid gap-4 md:grid-cols-12 items-center">
                        <div className="md:col-span-8 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">
                              {hosp.name}
                            </h3>
                          </div>

                          {/* Available Specialized Doctors */}
                          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1">
                            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                              <Stethoscope size={13} className="text-sky-600" />
                              <span>On-Duty Doctors:</span>
                            </p>

                            {doctors.length > 0 ? (
                              doctors.map((doc: any, dIdx: number) => (
                                <div
                                  key={dIdx}
                                  className="flex items-center justify-between text-xs bg-white px-2 py-1 rounded border border-slate-200"
                                >
                                  <span className="font-medium text-slate-800">
                                    {doc.name} ({doc.specialization.replace("_", " ")})
                                  </span>
                                  <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Available
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500 italic">
                                General emergency physician on duty.
                              </p>
                            )}
                          </div>

                          {/* Beds Info */}
                          <div className="text-xs text-slate-600 flex items-center gap-4">
                            <span>
                              Emergency Beds: <strong className="text-emerald-700">{hosp.availableBeds} / {hosp.totalBeds} Available</strong>
                            </span>
                          </div>

                          {/* Hospital Alerts / Distance Warnings */}
                          {hosp.warnings && hosp.warnings.length > 0 && (
                            <div className="space-y-1 pt-1">
                              {hosp.warnings.map((warn, wIdx) => (
                                <p
                                  key={wIdx}
                                  className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium"
                                >
                                  <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                                  <span>{warn}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action Button */}
                        <div className="md:col-span-4">
                          <button
                            onClick={() => handleSelectHospital(hosp)}
                            className={`w-full py-2.5 px-3 rounded-lg font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 ${
                              isTop
                                ? "bg-sky-600 hover:bg-sky-700 text-white"
                                : "bg-slate-900 hover:bg-slate-800 text-white"
                            }`}
                          >
                            <span>Select Hospital & View Route</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: MAIN ROUTE MAP VIEW & TRAFFIC SIGNALS ALONG ROUTE                 */}
        {/* ========================================================================= */}
        {currentStep === 4 && selectedHospital && (
          <div className="space-y-4">
            {/* Top Bar for Step 4 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  title="Back"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Destination: {selectedHospital.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Distance: <strong className="text-slate-700">{selectedHospital.distanceKm.toFixed(1)} km</strong> · ETA: <strong className="text-sky-700 font-mono">{selectedHospital.etaMinutes} mins (Arrival at {calculateEtaAmPm(selectedHospital.etaMinutes)})</strong> · Condition: {getActiveCaseTitle()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Change Hospital
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Change Location
                </button>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                >
                  Change Condition
                </button>
              </div>
            </div>

            {/* THE MAIN ROUTE MAP: Signals displayed ONLY for this selected route */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="flex items-center justify-between pb-2 px-1 text-xs font-semibold text-slate-700">
                <span>Route Map</span>
                <span className="text-slate-500">
                  {displayedSignals.length} traffic signals active along route
                </span>
              </div>

              <MapView
                center={coords}
                ambulance={{ lat: coords[0], lng: coords[1], label: "Ambulance KA-09-G-3601" }}
                destination={{
                  lat: selectedHospital.latitude,
                  lng: selectedHospital.longitude,
                  name: selectedHospital.name,
                }}
                route={route}
                signals={displayedSignals} // Displayed only when route is selected!
                className="h-[500px] w-full rounded-lg"
                theme="light"
              />
            </div>

            {/* Green Corridor Control Panel */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Green Corridor Control
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Approaching signals (&lt;380m / ~30s ETA) receive emergency priority sequentially.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={emergency?.status === "ARRIVED"}
                    onClick={handleToggleSimulation}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {simulating && !isPaused ? (
                      <>
                        <Pause size={13} />
                        <span>Pause Simulation</span>
                      </>
                    ) : isPaused ? (
                      <>
                        <Play size={13} />
                        <span>Resume Simulation</span>
                      </>
                    ) : emergency?.status === "ARRIVED" ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Arrived at Hospital</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} />
                        <span>Start Route Simulation</span>
                      </>
                    )}
                  </button>

                  {(simulating || isPaused || emergency?.status === "ARRIVED") && (
                    <button
                      onClick={resetSimulation}
                      className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition"
                      title="Reset Route Simulation"
                    >
                      <RefreshCw size={13} />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {simulating && (
                <div className="mt-3 rounded-lg bg-sky-50 border border-sky-100 p-3 text-xs">
                  <div className="flex items-center justify-between font-semibold text-sky-900 mb-1">
                    <span>
                      Transit Progress: {transitProgress}% {isPaused ? "(Paused)" : ""}
                    </span>
                    <span>Speed: {isPaused ? "0" : speedKmh} km/h</span>
                  </div>
                  <div className="h-1.5 w-full bg-sky-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-600 transition-all duration-300 rounded-full"
                      style={{ width: `${transitProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Signals along route */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Signals Along Route ({displayedSignals.length}):
                  </p>
                  {activePrioritySignal && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1.5 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
                      Green Corridor Active: {activePrioritySignal.code} (PRIORITY GREEN)
                    </span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {displayedSignals.map((sig) => {
                    const isPri = sig.mode === "EMERGENCY_PRIORITY";
                    return (
                      <div
                        key={sig.id}
                        className={`p-2.5 rounded-lg border text-xs transition-all ${
                          isPri
                            ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300 shadow-sm"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className={isPri ? "text-emerald-950 font-bold" : "text-slate-900"}>{sig.code}</span>
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              isPri
                                ? "bg-emerald-500 animate-ping"
                                : sig.status === "GREEN"
                                ? "bg-emerald-500"
                                : sig.status === "YELLOW"
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                          />
                        </div>
                        <p className="mt-0.5 font-medium text-slate-700 truncate">{sig.name}</p>
                        <p className="mt-0.5 text-[11px] font-mono">
                          {isPri ? (
                            <span className="text-emerald-700 font-bold">EMERGENCY PRIORITY (GREEN)</span>
                          ) : (
                            <span
                              className={`font-semibold ${
                                sig.status === "GREEN"
                                  ? "text-emerald-600"
                                  : sig.status === "YELLOW"
                                  ? "text-amber-600"
                                  : "text-rose-600"
                              }`}
                            >
                              ● {sig.status} (NORMAL CYCLE)
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
