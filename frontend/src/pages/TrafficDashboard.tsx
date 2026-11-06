import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Compass,
  Radio,
  RadioTower,
  RotateCcw,
  ShieldCheck,
  Siren,
  TrafficCone,
  Volume2,
} from "lucide-react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { CorridorState, Emergency, Signal } from "../lib/types";
import { MapView } from "../components/MapView";
import { StatusBadge } from "../components/StatusBadge";

export function TrafficDashboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [corridor, setCorridor] = useState<CorridorState | null>(null);
  const [live, setLive] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [safety, setSafety] = useState("");
  const [overrideSignalId, setOverrideSignalId] = useState<string | null>(null);

  useEffect(() => {
    api<{ signals: Signal[]; safetyNote: string }>("/traffic/signals").then((d) => {
      setSignals(d.signals);
      setSafety(d.safetyNote);
    });
    api<{ emergencies: Emergency[] }>("/emergencies/active").then((d) => setEmergencies(d.emergencies));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on("corridor:update", (p: CorridorState) => {
      setCorridor(p);
      if (p.signals) setSignals(p.signals);
    });
    socket.on("ambulance:location", (p: { latitude: number; longitude: number; vehicleCode?: string; emergencyId?: string }) => {
      setLive({ lat: p.latitude, lng: p.longitude, label: p.vehicleCode });
      if (p.emergencyId) socket.emit("ops:subscribe", p.emergencyId);
    });
    socket.on("emergency:route", (p: { emergencyId: string; ambulance: { latitude: number; longitude: number; vehicleCode: string } }) => {
      setLive({ lat: p.ambulance.latitude, lng: p.ambulance.longitude, label: p.ambulance.vehicleCode });
      socket.emit("ops:subscribe", p.emergencyId);
      api<{ emergencies: Emergency[] }>("/emergencies/active").then((d) => setEmergencies(d.emergencies));
    });
    return () => {
      socket.off("corridor:update");
      socket.off("ambulance:location");
      socket.off("emergency:route");
    };
  }, []);

  const active = emergencies.find((e) => ["PENDING_HOSPITAL", "ACCEPTED", "EN_ROUTE"].includes(e.status));
  const dest = active?.hospital
    ? { lat: active.hospital.latitude, lng: active.hospital.longitude, name: active.hospital.name }
    : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Intelligent Transportation System</p>
          </div>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-white">Green Corridor Command Center</h1>
          <p className="text-xs text-slate-400">
            Mysore Metropolitan Traffic Control · Automated Sequential Preemption Protocol
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-semibold text-teal-300">
          <TrafficCone size={15} /> ATCS Simulation Active
        </div>
      </div>

      {/* Safety Compliance Notice */}
      <div className="rounded-2xl border border-teal-500/20 bg-navy-900/60 p-4 text-xs text-slate-300 backdrop-blur-xl flex items-start gap-3">
        <ShieldCheck size={20} className="text-teal-300 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Safety Boundary Protocol: </strong>
          {safety ||
            "LIFELINE 360 runs an emulated sequential green-corridor for demonstration. Signals are coordinated sequentially without altering real-world municipal controllers."}
        </div>
      </div>

      {/* Key Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs text-slate-400">Corridor Status</p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`flex h-3 w-3 rounded-full ${
                corridor?.corridorActive ? "bg-teal-400 animate-ping" : "bg-slate-500"
              }`}
            />
            <p className="text-xl font-bold text-white">
              {corridor?.corridorActive ? "EMERGENCY PRIORITY ACTIVE" : "NORMAL SIGNAL CYCLES"}
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {active ? `Target: ${active.hospital?.name || "Selected Hospital"}` : "No active ambulance transit"}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs text-slate-400">Current Preempted Signal</p>
          <p className="mt-1 text-xl font-bold text-teal-300">
            {corridor?.activeSignal ? `${corridor.activeSignal.code} · ${corridor.activeSignal.name}` : "None (Standby)"}
          </p>
          {corridor?.activeSignal?.distanceMeters != null ? (
            <p className="mt-2 text-xs text-slate-300">
              Ambulance is <strong className="text-white">{Math.round(corridor.activeSignal.distanceMeters)} m</strong> away (Approach &lt; 350m)
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-400">Armed when vehicle is within 350 meters</p>
          )}
        </div>

        <div className="card p-5">
          <p className="text-xs text-slate-400">Next Armed Intersection</p>
          <p className="mt-1 text-xl font-bold text-white">
            {corridor?.nextSignal ? `${corridor.nextSignal.code} · ${corridor.nextSignal.name}` : "—"}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Automatically activates as soon as current intersection is cleared (&lt; 40m)
          </p>
        </div>
      </div>

      {/* Dark Tactical Map */}
      <MapView
        ambulance={live}
        destination={dest}
        route={active?.route || []}
        signals={signals}
        className="h-[480px] w-full"
      />

      {/* Corridor Signal Board */}
      <div className="card overflow-x-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div>
            <h2 className="font-bold text-white text-base">Mysore Arterial Signal Board</h2>
            <p className="text-xs text-slate-400">
              Live aspect status, operating mode, and real-time distance telemetry.
            </p>
          </div>
          <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-300">
            8 Monitored Intersections
          </span>
        </div>

        <table className="mt-4 w-full text-left text-xs">
          <thead className="text-slate-400 border-b border-white/10 pb-2">
            <tr>
              <th className="py-2.5">Code</th>
              <th>Intersection Name</th>
              <th>Live Aspect</th>
              <th>Control Mode</th>
              <th>Distance to Ambulance</th>
              <th>Preemption Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {signals.map((s) => {
              const dist =
                live ? Math.round(haversine(live.lat, live.lng, s.latitude, s.longitude)) : null;
              const isPreempted = s.mode === "EMERGENCY_PRIORITY";
              return (
                <tr key={s.id} className={isPreempted ? "bg-teal-500/10" : ""}>
                  <td className="py-3 font-mono font-bold text-white">{s.code}</td>
                  <td className="font-semibold text-slate-200">{s.name}</td>
                  <td>
                    <StatusBadge value={s.status} />
                  </td>
                  <td>
                    <StatusBadge value={s.mode} />
                  </td>
                  <td className="font-mono text-slate-300">
                    {dist != null ? (
                      <span className={dist <= 350 ? "text-teal-300 font-bold" : ""}>
                        {dist} m {dist <= 350 ? "(Within Radius)" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {isPreempted ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-teal-300">
                        <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                        PREEMPTION ACTIVE
                      </span>
                    ) : (
                      <span className="text-slate-400">Local Cycle Plan</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Emergency Operations History */}
      <div className="card p-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h2 className="font-bold text-white text-base">Traffic Priority Audit Log</h2>
            <p className="text-xs text-slate-400">
              Real-time audit log of signal preemption events and ambulance corridor clearances.
            </p>
          </div>
          <span className="text-xs text-teal-300 font-mono">
            {emergencies.length} Logged Operations
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {emergencies.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">No active priority transitions logged.</p>
          ) : (
            emergencies.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-white/5 bg-navy-950/60 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
                    <Siren size={15} />
                  </div>
                  <div>
                    <span className="font-bold text-white">
                      {e.type.replaceAll("_", " ")} — Unit {e.ambulance?.vehicleCode}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Destination: {e.hospital?.name || "JSS Hospital"} · Distance: {e.distanceKm ?? 3.4} km
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <StatusBadge value={e.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
