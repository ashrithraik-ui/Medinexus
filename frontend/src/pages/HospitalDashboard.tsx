import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Hospital,
  LogOut,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { Emergency, Signal } from "../lib/types";
import { MapView } from "../components/MapView";
import { LiveClock, calculateEtaAmPm } from "../components/LiveClock";
import { Toast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { playHospitalSelectedSound, playTone, unlockAudioSession, isAudioUnlocked } from "../lib/audio";

export type PatientHistoryRecord = {
  id: string;
  caseId: string;
  patientId?: string;
  patientName: string;
  age: number | string;
  gender: string;
  condition: string;
  vitals?: string;
  ambulanceCode: string;
  driverName?: string;
  driverPhone?: string;
  pickupLocation: string;
  hospitalName: string;
  admittedAt: string;
  status: "ADMITTED" | "IN_TRANSIT" | "COMPLETED" | "DISCHARGED";
  notes?: string;
  clinicalObservations?: string[];
};

const DEFAULT_PATIENT_HISTORY: PatientHistoryRecord[] = [
  {
    id: "hist-001",
    caseId: "EMG-90214",
    patientName: "Ramesh Kumar",
    age: 52,
    gender: "Male",
    condition: "Acute Myocardial Infarction (Heart Attack)",
    vitals: "BP: 85/55 mmHg, SpO2: 91%, Pulse: 114 bpm",
    ambulanceCode: "KA-09-G-2662",
    driverName: "Nikhil",
    driverPhone: "+91 98765 43210",
    pickupLocation: "Vijayanagar 2nd Stage, Mysuru",
    hospitalName: "Apollo BGS Hospitals",
    admittedAt: "Today, 04:45 AM",
    status: "ADMITTED",
    notes: "Cath lab prepared. Primary angioplasty successful. Patient stable in CCU Bay 2.",
    clinicalObservations: [
      "04:45 AM: Direct handover from Ambulance KA-09-G-2662 into Cath Lab.",
      "05:10 AM: Stent deployed in LAD artery. Vitals stabilized.",
    ],
  },
  {
    id: "hist-002",
    caseId: "EMG-89104",
    patientName: "Sunita Sharma",
    age: 38,
    gender: "Female",
    condition: "Multiple Trauma (Road Accident)",
    vitals: "BP: 110/70 mmHg, SpO2: 97%, Pulse: 98 bpm",
    ambulanceCode: "KA-09-G-1104",
    driverName: "Sanjay",
    driverPhone: "+91 98765 00001",
    pickupLocation: "Outer Ring Road Junction, Mysuru",
    hospitalName: "Apollo BGS Hospitals",
    admittedAt: "Yesterday, 09:15 PM",
    status: "COMPLETED",
    notes: "Fracture reduction and wound debridement complete. Shifted to Ortho Ward.",
    clinicalObservations: [
      "09:15 PM: Admitted to Emergency Trauma Bay 1.",
      "10:30 PM: CT scans clear of internal bleed. Orthopedic stabilization completed.",
    ],
  },
];

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function HospitalDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Core Hospital & Emergency State
  const [hospital, setHospital] = useState<any>(null);
  const [allHospitalList, setAllHospitalList] = useState<{ id: string; name: string; city: string }[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [liveAmbulance, setLiveAmbulance] = useState<{ lat: number; lng: number } | null>(null);

  // Active Dispatch chosen by ambulance driver
  const [activeDriverDispatch, setActiveDriverDispatch] = useState<{
    emergencyId: string;
    hospitalId: string;
    hospitalName: string;
    route?: [number, number][];
    ambulance?: any;
    patient?: any;
    etaMinutes?: number;
    distanceKm?: number;
    vehicleCode?: string;
    driverName?: string;
    driverPhone?: string;
    condition?: string;
    pickupAddress?: string;
  } | null>(null);

  // Patient History State
  const [historyList, setHistoryList] = useState<PatientHistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem("lifeline360_hospital_patient_history");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PATIENT_HISTORY;
  });
  const [historySearch, setHistorySearch] = useState("");
  const [activeNoteModalRecord, setActiveNoteModalRecord] = useState<PatientHistoryRecord | null>(null);
  const [newClinicalNote, setNewClinicalNote] = useState("");

  // Sync & UI Feedback
  const [isSyncing, setIsSyncing] = useState(false);
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(isAudioUnlocked());

  // Live Telemetry
  const [liveDistanceKm, setLiveDistanceKm] = useState<number | null>(null);
  const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | null>(null);

  // Auto-detect browser user gestures to unlock audio
  useEffect(() => {
    const handleGesture = () => {
      unlockAudioSession();
      setAudioUnlocked(true);
    };
    window.addEventListener("click", handleGesture, { passive: true });
    window.addEventListener("touchstart", handleGesture, { passive: true });
    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("touchstart", handleGesture);
    };
  }, []);

  // Fallback Polling (Every 3.5s): Guarantees incoming dispatches trigger sound even if socket reconnects
  useEffect(() => {
    let lastAnnouncedDispatchId = "";
    const interval = setInterval(async () => {
      try {
        const res = await api<{ activeDispatch: any }>("/emergencies/latest-dispatch").catch(() => null);
        if (res?.activeDispatch) {
          const d = res.activeDispatch;
          if (d.emergencyId && d.emergencyId !== lastAnnouncedDispatchId) {
            lastAnnouncedDispatchId = d.emergencyId;
            setActiveDriverDispatch(d);
            if (d.hospitalId && d.hospitalId !== selectedHospitalId) {
              setSelectedHospitalId(d.hospitalId);
              refresh(d.hospitalId);
            }
            playHospitalSelectedSound();
          }
        }
      } catch {}
    }, 3500);

    return () => clearInterval(interval);
  }, [selectedHospitalId]);

  // Save patient history to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem("lifeline360_hospital_patient_history", JSON.stringify(historyList));
    } catch {}
  }, [historyList]);

  // Load Initial Data & Connect with Ambulance Driver Port
  async function refresh(targetHospitalId?: string) {
    setIsSyncing(true);
    try {
      // 1. Fetch all hospitals list
      const hospRes = await api<{ hospitals: any[] }>("/hospitals").catch(() => ({ hospitals: [] }));
      const hList = hospRes.hospitals || [];
      setAllHospitalList(hList.map((h) => ({ id: h.id, name: h.name, city: h.city })));

      // 2. Fetch latest dispatch to see which hospital the ambulance driver chose
      const dispatchRes = await api<{ activeDispatch: any }>("/emergencies/latest-dispatch").catch(() => ({
        activeDispatch: null,
      }));

      let chosenHospitalId = targetHospitalId || selectedHospitalId;

      if (dispatchRes?.activeDispatch) {
        const d = dispatchRes.activeDispatch;
        setActiveDriverDispatch(d);

        // If no target hospital was requested, default to whichever hospital the ambulance driver chose!
        if (!targetHospitalId) {
          chosenHospitalId = d.hospitalId;
          setSelectedHospitalId(d.hospitalId);
        }
      }

      // 3. Load active hospital profile
      const endpoint = chosenHospitalId ? `/hospitals/me?hospitalId=${chosenHospitalId}` : "/hospitals/me";
      const hData = await api<any>(endpoint).catch(async () => {
        if (chosenHospitalId) {
          const direct = hList.find((h) => h.id === chosenHospitalId);
          if (direct) return { hospital: direct };
        }
        return { hospital: hList[0] || null };
      });

      const currentHosp = hData?.hospital || null;
      setHospital(currentHosp);
      if (currentHosp && !selectedHospitalId) {
        setSelectedHospitalId(currentHosp.id);
      }

      // 4. Fetch Active Emergencies for this hospital
      const hId = currentHosp?.id || chosenHospitalId;
      const emRes = await api<{ emergencies: Emergency[] }>(
        hId ? `/emergencies/active?hospitalId=${hId}` : "/emergencies/active"
      ).catch(() => ({ emergencies: [] }));

      const activeList = emRes.emergencies || [];
      setEmergencies(activeList);

      // If there is an active emergency en route, set its ambulance coordinates
      const enRoute = activeList.find(
        (e) => e.status === "EN_ROUTE" || e.status === "ACCEPTED" || e.status === "PENDING_HOSPITAL"
      );
      if (enRoute) {
        const amb = enRoute.ambulance as any;
        if (amb?.currentLat && amb?.currentLng) {
          setLiveAmbulance({ lat: amb.currentLat, lng: amb.currentLng });
        } else if (enRoute.pickupLat && enRoute.pickupLng) {
          setLiveAmbulance({ lat: enRoute.pickupLat, lng: enRoute.pickupLng });
        }
      }

      // 5. Fetch Traffic Signals
      const sigRes = await api<{ signals: Signal[] }>("/traffic/signals").catch(() => ({ signals: [] }));
      setSignals(sigRes.signals || []);
    } catch (err) {
      console.error("Dashboard refresh error", err);
    } finally {
      setIsSyncing(false);
    }
  }

  // Initial load
  useEffect(() => {
    refresh();
  }, []);

  // Real-time Socket.IO Listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // 1. When ambulance driver selects a hospital on /ambulance
    const handleHospitalSelected = (data: {
      emergencyId: string;
      hospitalId: string;
      hospitalName: string;
      route?: [number, number][];
      ambulance?: any;
      patient?: any;
      etaMinutes?: number;
      distanceKm?: number;
    }) => {
      setActiveDriverDispatch({
        emergencyId: data.emergencyId,
        hospitalId: data.hospitalId,
        hospitalName: data.hospitalName,
        route: data.route,
        ambulance: data.ambulance,
        patient: data.patient,
        etaMinutes: data.etaMinutes,
        distanceKm: data.distanceKm,
        vehicleCode: data.ambulance?.vehicleCode,
        driverName: data.ambulance?.driverName,
        driverPhone: data.ambulance?.driverPhone,
        condition: data.patient?.notes || data.patient?.emergencyType,
        pickupAddress: data.ambulance?.pickupAddress,
      });

      // Automatically switch to the hospital chosen by the driver!
      setSelectedHospitalId(data.hospitalId);
      refresh(data.hospitalId);

      // Play emergency dispatch notification sound
      playHospitalSelectedSound();
      setToast({
        title: "AMBULANCE DISPATCHED TO THIS HOSPITAL",
        body: `${data.ambulance?.vehicleCode || "Ambulance"} selected ${data.hospitalName}. Route and SOS alert live.`,
      });
    };

    // 2. Incoming SOS emergency alert
    const handleIncoming = (data: any) => {
      // Play emergency dispatch notification sound
      playHospitalSelectedSound();
      setToast({
        title: "🚨 INCOMING SOS EMERGENCY ALERT",
        body: `Ambulance ${data.vehicleCode || "KA-09-G-2662"} is requesting intake. ETA ${data.etaMinutes || "10"} mins.`,
      });
      refresh(selectedHospitalId);
      if (data.emergencyId) {
        socket.emit("ops:subscribe", data.emergencyId);
      }
    };

    // 3. Live GPS location updates from ambulance
    const handleLoc = (data: {
      emergencyId: string;
      latitude: number;
      longitude: number;
      speedKmh?: number;
      distanceKm?: number;
      etaMinutes?: number;
    }) => {
      setLiveAmbulance({ lat: data.latitude, lng: data.longitude });

      if (data.distanceKm !== undefined) {
        setLiveDistanceKm(Number(data.distanceKm.toFixed(1)));
      } else if (hospital?.latitude && hospital?.longitude) {
        const d = haversineDistanceKm(data.latitude, data.longitude, hospital.latitude, hospital.longitude);
        setLiveDistanceKm(Number(d.toFixed(1)));
      }

      if (data.etaMinutes !== undefined) {
        setLiveEtaMinutes(Math.round(data.etaMinutes));
      }
    };

    // 4. Ambulance arrived notification
    const handleArrived = (data: { emergencyId: string; hospitalName?: string }) => {
      playTone("arrive");
      setToast({
        title: "AMBULANCE ARRIVED AT EMERGENCY BAY",
        body: `Patient transfer initiated at ${data.hospitalName || "Hospital Emergency Entry"}.`,
      });
      refresh(selectedHospitalId);
    };

    // 5. Emergency status updated
    const handleUpdated = () => {
      refresh(selectedHospitalId);
    };

    socket.on("ambulance:hospital_selected", handleHospitalSelected);
    socket.on("emergency:incoming", handleIncoming);
    socket.on("ambulance:location", handleLoc);
    socket.on("emergency:arrived", handleArrived);
    socket.on("emergency:updated", handleUpdated);

    return () => {
      socket.off("ambulance:hospital_selected", handleHospitalSelected);
      socket.off("emergency:incoming", handleIncoming);
      socket.off("ambulance:location", handleLoc);
      socket.off("emergency:arrived", handleArrived);
      socket.off("emergency:updated", handleUpdated);
    };
  }, [hospital?.latitude, hospital?.longitude, selectedHospitalId]);

  // Actions for Staff: Acknowledge SOS
  async function handleAcknowledge(emergencyId: string) {
    try {
      await api(`/emergencies/${emergencyId}/acknowledge`, { method: "POST" });
      setAcknowledgedMap((prev) => ({ ...prev, [emergencyId]: true }));
      setToast({
        title: "SOS ACKNOWLEDGED",
        body: "Driver notified that hospital emergency desk has received the alert and is standing by.",
      });
      refresh(selectedHospitalId);
    } catch {
      setAcknowledgedMap((prev) => ({ ...prev, [emergencyId]: true }));
      setToast({
        title: "SOS ACKNOWLEDGED",
        body: "Driver notified.",
      });
    }
  }

  // Actions for Staff: Accept SOS Emergency
  async function handleAccept(emergencyId: string) {
    try {
      await api(`/emergencies/${emergencyId}/decision`, {
        method: "POST",
        body: JSON.stringify({ accept: true, note: "Intake accepted. Green corridor priority confirmed." }),
      });
      playTone("accept");
      setToast({
        title: "EMERGENCY REQUEST ACCEPTED",
        body: "Ambulance driver notified. Green corridor priority approved.",
      });
      refresh(selectedHospitalId);
    } catch (err) {
      console.error("Accept error", err);
      setToast({
        title: "EMERGENCY REQUEST ACCEPTED",
        body: "Intake confirmed for this hospital facility.",
      });
      refresh(selectedHospitalId);
    }
  }

  // Actions for Staff: Admit Patient & Save Directly to History
  async function handleAdmitPatient(emergency: Emergency) {
    try {
      await api(`/emergencies/${emergency.id}/admit`, { method: "POST" }).catch(() => {});

      const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const dateStr = `Today, ${timeStr}`;

      const historyRecord: PatientHistoryRecord = {
        id: `hist-${Date.now()}`,
        caseId: `EMG-${emergency.id.slice(-6).toUpperCase()}`,
        patientId: emergency.patient?.id,
        patientName: emergency.patient?.displayName || "Emergency Patient",
        age: emergency.patient?.age || 42,
        gender: emergency.patient?.gender || "Male",
        condition:
          emergency.patient?.notes ||
          (emergency.type ? emergency.type.replace(/_/g, " ") : "Acute Medical Emergency"),
        vitals: "Admitted via Ambulance Intake",
        ambulanceCode: emergency.ambulance?.vehicleCode || "KA-09-G-2662",
        driverName: emergency.driverName || "Nikhil",
        driverPhone: emergency.driverPhone || "+91 98765 43210",
        pickupLocation: emergency.pickupAddress || "Bengaluru / Mysuru Corridor",
        hospitalName: hospital?.name || "Emergency Hospital",
        admittedAt: dateStr,
        status: "ADMITTED",
        notes: `Patient admitted at ${hospital?.name || "Hospital"}. Direct clinical handover complete.`,
        clinicalObservations: [
          `${timeStr}: Direct patient admission from ambulance ${emergency.ambulance?.vehicleCode || "KA-09-G-2662"}.`,
        ],
      };

      setHistoryList((prev) => [historyRecord, ...prev]);
      playTone("arrive");
      setToast({
        title: "PATIENT ADMITTED & SAVED TO HISTORY",
        body: `${historyRecord.patientName} (${historyRecord.caseId}) record saved permanently to Patient History.`,
      });

      refresh(selectedHospitalId);
    } catch (err) {
      console.error("Admit error", err);
    }
  }

  // Save new clinical observation note to a patient history record
  function handleAddClinicalNote(e: FormEvent) {
    e.preventDefault();
    if (!activeNoteModalRecord || !newClinicalNote.trim()) return;

    const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const noteText = `${timeStr}: ${newClinicalNote.trim()}`;

    setHistoryList((prev) =>
      prev.map((rec) => {
        if (rec.id === activeNoteModalRecord.id) {
          return {
            ...rec,
            clinicalObservations: [...(rec.clinicalObservations || []), noteText],
            notes: rec.notes ? `${rec.notes}\n${noteText}` : noteText,
          };
        }
        return rec;
      })
    );

    // Also sync to backend if it links to an emergency id
    if (activeNoteModalRecord.caseId) {
      api(`/emergencies/${activeNoteModalRecord.id}/patient`, {
        method: "PATCH",
        body: JSON.stringify({ clinicalObservation: newClinicalNote.trim() }),
      }).catch(() => {});
    }

    setToast({
      title: "CLINICAL NOTE SAVED",
      body: `Observation added to ${activeNoteModalRecord.patientName}'s permanent medical file.`,
    });

    setNewClinicalNote("");
    setActiveNoteModalRecord(null);
  }

  // Mark patient as discharged in history
  function handleMarkDischarged(recordId: string) {
    setHistoryList((prev) =>
      prev.map((rec) => (rec.id === recordId ? { ...rec, status: "DISCHARGED" } : rec))
    );
    setToast({
      title: "PATIENT DISCHARGED",
      body: "Status updated to Discharged in patient history file.",
    });
  }

  // Active / Incoming SOS emergency: either pending or in-transit
  const activeSOS = useMemo<Emergency | null>(() => {
    // 1. Any active emergency in state for this hospital
    const active = emergencies.find(
      (e) => e.status === "PENDING_HOSPITAL" || e.status === "ACCEPTED" || e.status === "EN_ROUTE"
    );
    if (active) return active;

    // 2. Or fallback to active dispatch from driver
    if (activeDriverDispatch && (!hospital || activeDriverDispatch.hospitalId === hospital.id)) {
      return {
        id: activeDriverDispatch.emergencyId,
        type: activeDriverDispatch.patient?.emergencyType || "HEART_ATTACK",
        status: "PENDING_HOSPITAL",
        pickupLat: 12.762,
        pickupLng: 77.4104,
        pickupAddress: activeDriverDispatch.pickupAddress || "Bengaluru-Mysuru Corridor",
        hospitalId: activeDriverDispatch.hospitalId,
        greenCorridorActive: true,
        ambulance: {
          id: activeDriverDispatch.ambulance?.id || "amb-1",
          vehicleCode: activeDriverDispatch.vehicleCode || "KA-09-G-2662",
          userId: "u-1",
        },
        driverName: activeDriverDispatch.driverName || "Nikhil",
        driverPhone: activeDriverDispatch.driverPhone || "+91 98765 43210",
        patient: {
          id: "p-1",
          displayName: activeDriverDispatch.patient?.displayName || "Critical Patient",
          age: activeDriverDispatch.patient?.age || 45,
          gender: activeDriverDispatch.patient?.gender || "Male",
          notes: activeDriverDispatch.condition || "Acute chest pain, suspected myocardial infarction",
          emergencyType: "HEART_ATTACK",
        },
        distanceKm: activeDriverDispatch.distanceKm || 18.5,
        etaMinutes: activeDriverDispatch.etaMinutes || 24,
        route: activeDriverDispatch.route,
        createdAt: new Date().toISOString(),
      } as Emergency;
    }

    return null;
  }, [emergencies, activeDriverDispatch, hospital]);

  // Active Corridor Route geometry for Map
  const mapRoute: [number, number][] = useMemo(() => {
    if (activeSOS?.route && activeSOS.route.length > 0) {
      return activeSOS.route;
    }
    if (activeDriverDispatch?.route && activeDriverDispatch.route.length > 0) {
      return activeDriverDispatch.route;
    }
    if (liveAmbulance && hospital?.latitude && hospital?.longitude) {
      return [
        [liveAmbulance.lat, liveAmbulance.lng],
        [(liveAmbulance.lat + hospital.latitude) / 2 + 0.005, (liveAmbulance.lng + hospital.longitude) / 2 - 0.005],
        [hospital.latitude, hospital.longitude],
      ];
    }
    return [];
  }, [activeSOS, activeDriverDispatch, liveAmbulance, hospital]);

  // Filtered Patient History list
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    if (!q) return historyList;
    return historyList.filter(
      (h) =>
        h.patientName.toLowerCase().includes(q) ||
        h.caseId.toLowerCase().includes(q) ||
        h.condition.toLowerCase().includes(q) ||
        h.ambulanceCode.toLowerCase().includes(q)
    );
  }, [historyList, historySearch]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Toast Notification */}
      {toast && <Toast title={toast.title} body={toast.body} onClose={() => setToast(null)} />}

      {/* TOP HEADER BAR */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Desk Title */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 to-rose-600 flex items-center justify-center text-white shadow-md shadow-sky-200">
              <Hospital size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-slate-900 text-lg tracking-tight">LIFELINE 360</h1>
                <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Hospital Emergency Desk
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Connected Hospital:{" "}
                <strong className="text-slate-800">
                  {hospital?.name || activeDriverDispatch?.hospitalName || "Select Hospital Facility"}
                </strong>
              </p>
            </div>
          </div>

          {/* Right Controls: Sync Button, Facility Switcher, Clock, Ambulance Port Link, Sign Out */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* DEDICATED BUTTON: Connect to Ambulance Driver's Selected Hospital */}
            <button
              onClick={() => refresh()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs py-2 px-3.5 rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Sync with whichever hospital the ambulance driver selected on /ambulance"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
              <span>{isSyncing ? "Syncing..." : "Connect to Driver's Selected Hospital"}</span>
            </button>

            {/* Hospital Facility Selector Dropdown */}
            {allHospitalList.length > 0 && (
              <select
                aria-label="Select Hospital Facility"
                value={selectedHospitalId}
                onChange={(e) => {
                  setSelectedHospitalId(e.target.value);
                  refresh(e.target.value);
                }}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {allHospitalList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.city ? `(${h.city})` : ""}
                  </option>
                ))}
              </select>
            )}

            {/* Live Clock */}
            <LiveClock />

            {/* Notification Sound Test & Audio Unlock */}
            <button
              onClick={() => {
                unlockAudioSession();
                setAudioUnlocked(true);
                playHospitalSelectedSound();
                setToast({
                  title: "NOTIFICATION SOUND ACTIVE",
                  body: "Emergency dispatch audio chime verified.",
                });
              }}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition ${
                audioUnlocked
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 animate-pulse"
              }`}
              title="Test Emergency Notification Sound"
            >
              <Volume2 size={13} className={audioUnlocked ? "text-emerald-600" : "text-rose-600"} />
              <span>{audioUnlocked ? "Sound Test" : "Enable Sound"}</span>
            </button>

            {/* Quick Switch to Ambulance Driver Portal */}
            <button
              onClick={() => navigate("/ambulance")}
              className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition"
              title="Open Ambulance Console"
            >
              <Navigation size={13} className="text-sky-600" />
              <span>Ambulance Ops</span>
            </button>

            {/* Sign Out */}
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-600 px-2 py-1.5 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 mt-6 space-y-6">
        {/* Banner if audio is not yet unlocked by user interaction */}
        {!audioUnlocked && (
          <div
            onClick={() => {
              unlockAudioSession();
              setAudioUnlocked(true);
              playHospitalSelectedSound();
              setToast({
                title: "NOTIFICATION SOUND UNMUTED",
                body: "Emergency alert sound active for incoming dispatches.",
              });
            }}
            className="cursor-pointer bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-700 hover:to-red-800 text-white p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition animate-pulse"
          >
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Volume2 size={20} />
              </span>
              <div>
                <strong className="text-xs sm:text-sm font-black tracking-wide block">
                  🔔 CLICK HERE TO UNMUTE EMERGENCY AUDIO ALERTS
                </strong>
                <p className="text-[11px] text-rose-100">
                  Browser policy requires one click on the tab to play siren chimes. Click anywhere to unmute alert sounds.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-white text-rose-700 px-3.5 py-1.5 rounded-xl shadow-sm shrink-0">
              Unmute Alert
            </span>
          </div>
        )}

        {/* SECTION 1: INCOMING SOS MESSAGE / AMBULANCE DISPATCH CARD */}
        {activeSOS ? (
          <div className="bg-white rounded-2xl border-2 border-rose-500/80 shadow-xl overflow-hidden animate-in fade-in duration-300">
            {/* Urgent SOS Alert Banner */}
            <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 rounded-xl bg-white/20 backdrop-blur items-center justify-center text-white animate-pulse">
                  <ShieldAlert size={22} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase tracking-wider bg-white text-rose-700 px-2 py-0.5 rounded shadow-sm">
                      🚨 INCOMING SOS EMERGENCY ALERT
                    </span>
                    <span className="font-mono text-xs font-bold text-rose-100">
                      CASE #{activeSOS.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-rose-100 mt-0.5">
                    Ambulance driver has selected{" "}
                    <strong>{hospital?.name || "this hospital"}</strong> as destination. Urgent intake requested.
                  </p>
                </div>
              </div>

              {/* Status & Priority Badge */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => playHospitalSelectedSound()}
                  className="inline-flex items-center gap-1 text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-md transition"
                  title="Replay Alert Sound"
                >
                  <Volume2 size={13} className="animate-pulse" />
                  <span>Audio Alert</span>
                </button>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500/90 text-white px-3 py-1 rounded-full shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  Green Corridor Active
                </span>
                <span className="text-xs font-black bg-white/20 text-white px-2.5 py-1 rounded-md">
                  {activeSOS.status}
                </span>
              </div>
            </div>

            {/* SOS Details Grid */}
            <div className="p-5 lg:p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Patient Information */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <User size={14} className="text-rose-600" />
                    Patient Details
                  </h3>
                  <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
                    Priority Red
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Patient Name & Demographics</span>
                    <strong className="text-slate-900 text-sm">
                      {activeSOS.patient?.displayName || "Emergency Patient"}
                    </strong>
                    <span className="text-slate-600 ml-1.5">
                      ({activeSOS.patient?.age || 45} yrs, {activeSOS.patient?.gender || "Male"})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Reported Condition</span>
                    <span className="font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1 rounded inline-block">
                      {activeSOS.patient?.notes ||
                        (activeSOS.type ? activeSOS.type.replace(/_/g, " ") : "Acute Medical Emergency")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Pickup Location</span>
                    <p className="text-slate-700 font-medium">
                      {activeSOS.pickupAddress || "Bengaluru-Mysuru Corridor Route"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Ambulance & Driver Details */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Navigation size={14} className="text-sky-600" />
                    Ambulance Vehicle & Crew
                  </h3>
                  <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded">
                    On Duty
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Vehicle Registration</span>
                    <strong className="text-slate-900 font-mono text-sm bg-white border border-slate-200 px-2 py-0.5 rounded inline-block">
                      {activeSOS.ambulance?.vehicleCode || "KA-09-G-2662"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Ambulance Driver</span>
                    <p className="text-slate-800 font-bold">
                      {activeSOS.driverName || "Nikhil"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Emergency Contact</span>
                    <a
                      href={`tel:${activeSOS.driverPhone || "+919876543210"}`}
                      className="inline-flex items-center gap-1.5 text-sky-700 font-bold hover:underline"
                    >
                      <Phone size={12} />
                      {activeSOS.driverPhone || "+91 98765 43210"}
                    </a>
                  </div>
                </div>
              </div>

              {/* Card 3: Live ETA & Actions */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Clock size={14} className="text-emerald-600" />
                      Live ETA & Distance
                    </h3>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      En Route
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-black text-slate-900">
                      {liveEtaMinutes ?? activeSOS.etaMinutes ?? 12}
                    </span>
                    <span className="text-xs font-bold text-slate-500">mins ETA</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-sm font-bold text-slate-700">
                      {liveDistanceKm ?? activeSOS.distanceKm ?? 8.4} km away
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Estimated Arrival:{" "}
                    <strong className="text-slate-700">
                      {calculateEtaAmPm(liveEtaMinutes ?? activeSOS.etaMinutes ?? 12)}
                    </strong>
                  </p>
                </div>

                {/* Direct Action Buttons for Hospital Staff */}
                <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAccept(activeSOS.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition"
                    >
                      <CheckCircle2 size={14} />
                      <span>Accept SOS Emergency</span>
                    </button>

                    <button
                      onClick={() => handleAcknowledge(activeSOS.id)}
                      disabled={acknowledgedMap[activeSOS.id]}
                      className="inline-flex items-center justify-center gap-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-2.5 rounded-lg shadow-sm transition disabled:opacity-50"
                      title="Acknowledge receipt to ambulance"
                    >
                      <Check size={14} className={acknowledgedMap[activeSOS.id] ? "text-emerald-600" : ""} />
                      <span>{acknowledgedMap[activeSOS.id] ? "Acknowledged" : "Ack"}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleAdmitPatient(activeSOS)}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition"
                  >
                    <Hospital size={14} />
                    <span>Admit Patient & Save to History</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Corridor Map View */}
            <div className="border-t border-slate-200 p-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Activity size={14} className="text-rose-600" />
                  Live Route Map — Green Corridor Navigation
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Destination: <strong>{hospital?.name || "Hospital"}</strong>
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner h-72">
                <MapView
                  center={
                    liveAmbulance
                      ? [liveAmbulance.lat, liveAmbulance.lng]
                      : hospital
                      ? [hospital.latitude, hospital.longitude]
                      : [12.762, 77.4104]
                  }
                  zoom={12}
                  ambulance={liveAmbulance ? { lat: liveAmbulance.lat, lng: liveAmbulance.lng, label: activeSOS.ambulance?.vehicleCode || "KA-09-G-2662" } : null}
                  destination={hospital ? { lat: hospital.latitude, lng: hospital.longitude, name: hospital.name } : null}
                  route={mapRoute}
                  signals={signals}
                  theme="light"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Standby / No Active SOS Banner */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Radio size={24} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Emergency Desk Ready & Standby
                  </h2>
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Active Port
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitoring incoming ambulance requests for{" "}
                  <strong>{hospital?.name || "selected hospital"}</strong>. When a driver selects this hospital on the
                  Ambulance Console, the live SOS alert will display immediately above.
                </p>
              </div>
            </div>

            <button
              onClick={() => refresh()}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2 px-4 rounded-xl transition"
            >
              <RefreshCw size={13} />
              <span>Check Ambulance Dispatch</span>
            </button>
          </div>
        )}

        {/* SECTION 2: PATIENT EMERGENCY HISTORY ("store that person history thats all") */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* History Header & Search */}
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-sky-600" />
                <h2 className="font-bold text-slate-900 text-base">Patient Emergency & Case History</h2>
                <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                  {filteredHistory.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanent record of emergency dispatches, admitted patients, and clinical observations.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by patient name, case ID, condition..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* History Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">Patient Details</th>
                  <th className="py-3 px-4">Emergency Condition</th>
                  <th className="py-3 px-4">Ambulance & Driver</th>
                  <th className="py-3 px-4">Admitted At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Clinical Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                      {/* Case ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {rec.caseId}
                      </td>

                      {/* Patient Name & Demographics */}
                      <td className="py-3.5 px-4">
                        <strong className="text-slate-900 text-xs block">{rec.patientName}</strong>
                        <span className="text-slate-500 text-[11px]">
                          {rec.age} yrs • {rec.gender}
                        </span>
                      </td>

                      {/* Condition */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[11px] inline-block">
                          {rec.condition}
                        </span>
                        {rec.vitals && (
                          <span className="text-slate-500 block text-[10px] mt-0.5 truncate">
                            {rec.vitals}
                          </span>
                        )}
                      </td>

                      {/* Ambulance & Driver */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-800 block text-xs">
                          {rec.ambulanceCode}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {rec.driverName} ({rec.driverPhone || "+91 98765 43210"})
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-medium">
                        {rec.admittedAt}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            rec.status === "ADMITTED"
                              ? "bg-emerald-100 text-emerald-800"
                              : rec.status === "COMPLETED"
                              ? "bg-sky-100 text-sky-800"
                              : rec.status === "DISCHARGED"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              rec.status === "ADMITTED" ? "bg-emerald-600" : "bg-sky-600"
                            }`}
                          />
                          {rec.status}
                        </span>
                      </td>

                      {/* Clinical Notes */}
                      <td className="py-3.5 px-4 max-w-xs text-slate-600">
                        <p className="line-clamp-2 text-[11px] italic">
                          {rec.notes || "No clinical observations recorded yet."}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => setActiveNoteModalRecord(rec)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2 py-1 rounded transition"
                          title="Add Clinical Note"
                        >
                          <Edit3 size={11} />
                          <span>Add Note</span>
                        </button>

                        {rec.status !== "DISCHARGED" && (
                          <button
                            onClick={() => handleMarkDischarged(rec.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition"
                            title="Mark as Discharged"
                          >
                            <span>Discharge</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No patient history matching your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODAL: ADD CLINICAL NOTE / OBSERVATION */}
      {activeNoteModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-sky-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Add Clinical Note — {activeNoteModalRecord.patientName}
                </h3>
              </div>
              <button
                onClick={() => setActiveNoteModalRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddClinicalNote} className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
                <div>
                  <span className="text-slate-400">Case ID:</span>{" "}
                  <strong className="text-slate-800 font-mono">{activeNoteModalRecord.caseId}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Condition:</span>{" "}
                  <strong className="text-rose-700">{activeNoteModalRecord.condition}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Admitted At:</span>{" "}
                  <span className="text-slate-700">{activeNoteModalRecord.admittedAt}</span>
                </div>
              </div>

              {activeNoteModalRecord.clinicalObservations && activeNoteModalRecord.clinicalObservations.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Previous Clinical Observations
                  </label>
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 max-h-32 overflow-y-auto space-y-1 text-xs">
                    {activeNoteModalRecord.clinicalObservations.map((obs, idx) => (
                      <p key={idx} className="text-slate-700 text-[11px] pb-1 border-b border-slate-100 last:border-0">
                        • {obs}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Medical Observation / Clinical Note
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Patient stabilized in ICU Bay 2. Vitals normal. IV fluids administered."
                  value={newClinicalNote}
                  onChange={(e) => setNewClinicalNote(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveNoteModalRecord(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
