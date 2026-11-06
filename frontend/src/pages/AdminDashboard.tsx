import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  Ambulance,
  Bed,
  CheckCircle2,
  Clock,
  Compass,
  Hospital,
  Shield,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";

export function AdminDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [tab, setTab] = useState<"overview" | "users" | "hospitals" | "ambulances" | "history">("overview");

  async function load() {
    const [o, u, a, e] = await Promise.all([
      api<any>("/admin/overview"),
      api<{ users: any[] }>("/admin/users"),
      api<{ ambulances: any[] }>("/admin/ambulances"),
      api<{ emergencies: any[] }>("/admin/emergencies"),
    ]);
    setOverview(o);
    setUsers(u.users);
    setAmbulances(a.ambulances);
    setEmergencies(e.emergencies);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const chart = (overview?.hospitalAvailability || []).map((h: any) => ({
    name: h.name.split(" ")[0],
    beds: h.beds?.available || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Central Administration</p>
          </div>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-white">System Command & Telemetry</h1>
          <p className="text-xs text-slate-400">
            Network oversight, live hospital capacity distribution, and emergency dispatch audits.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-semibold text-teal-300">
          <ShieldCheck size={15} /> Root Operations Panel
        </div>
      </div>

      {/* Navigation Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {(["overview", "users", "hospitals", "ambulances", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-xs font-bold capitalize transition shadow-sm ${
              tab === t
                ? "bg-accent-teal text-navy-950 shadow-glow"
                : "border border-white/10 bg-navy-900/60 text-slate-300 hover:bg-white/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {tab === "overview" && overview && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Ambulances", overview.totals.ambulances, Ambulance, "text-teal-300"],
              ["Hospitals", overview.totals.hospitals, Hospital, "text-blue-300"],
              ["Emergencies", overview.totals.emergencies, Siren, "text-rose-300"],
              ["Active Operations", overview.totals.active, Activity, "text-emerald-300"],
              ["System Users", overview.totals.users, Users, "text-purple-300"],
            ].map(([k, v, Icon, colorClass]) => (
              <div key={String(k)} className="card p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">{k as string}</p>
                  <Icon size={18} className={colorClass as string} />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-white">{v as string}</p>
              </div>
            ))}
          </div>

          {/* Hospital Bed Availability Chart */}
          <div className="card p-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-4">
              <div>
                <h2 className="font-bold text-white text-base">Mysore Hospital Bed Availability</h2>
                <p className="text-xs text-slate-400">
                  Real-time bed counts across certified trauma and general hospitals.
                </p>
              </div>
              <span className="text-xs font-semibold text-teal-300">Live Telemetry</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#071324",
                      borderColor: "rgba(255,255,255,0.15)",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="beds" fill="#2ee6c6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Logs */}
          <div className="card p-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h2 className="font-bold text-white text-base">System Audit Log</h2>
              <span className="text-xs text-slate-400">20 Most Recent Events</span>
            </div>
            <div className="space-y-2 text-xs">
              {overview.logs.map((l: any) => (
                <div
                  key={l.id}
                  className="rounded-xl border border-white/5 bg-navy-950/50 p-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-teal-300">{l.action}</span>
                    <span className="text-slate-300">— {l.detail}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(l.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Users Management */}
      {tab === "users" && (
        <div className="card overflow-x-auto p-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
            <div>
              <h2 className="font-bold text-white text-base">Registered System Users</h2>
              <p className="text-xs text-slate-400">Role-based access credentials for drivers, hospitals, and traffic police.</p>
            </div>
            <span className="text-xs text-slate-400">{users.length} Total Users</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-white/10 pb-2">
              <tr>
                <th className="py-2.5">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Affiliated Unit / Facility</th>
                <th>Active Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 font-bold text-white">{u.name}</td>
                  <td className="font-mono text-slate-300">{u.email}</td>
                  <td>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-teal-300">
                      {u.role.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="text-slate-300">{u.hospital || u.ambulance || "Central HQ"}</td>
                  <td>
                    <button
                      className={`rounded-lg px-2.5 py-0.5 text-[10px] font-bold transition ${
                        u.isActive
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                      onClick={async () => {
                        await api(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !u.isActive }) });
                        load();
                      }}
                    >
                      {u.isActive ? "Active (Click to Deactivate)" : "Disabled"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Hospitals Management */}
      {tab === "hospitals" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(overview?.hospitalAvailability || []).map((h: any) => (
            <div key={h.id} className="card p-5 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-white text-base">{h.name}</p>
                  <p className="text-xs text-slate-400">{h.address}</p>
                </div>
                <StatusBadge value={h.readinessStatus} />
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-300">
                <span>Emergency Bed Capacity:</span>
                <strong className="text-teal-300">{h.beds?.available} of {h.beds?.total} Available</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Ambulances */}
      {tab === "ambulances" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ambulances.map((a) => (
            <div key={a.id} className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white font-mono text-base">{a.vehicleCode}</p>
                  <p className="text-xs text-slate-400">Driver: {a.driver}</p>
                </div>
                <StatusBadge value={a.status} />
              </div>
              <p className="mt-3 text-[11px] text-teal-300">Mysore Metro Emergency Services</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: History */}
      {tab === "history" && (
        <div className="card p-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
            <h2 className="font-bold text-white text-base">All Emergency Incidents</h2>
            <span className="text-xs text-slate-400">{emergencies.length} Operations Recorded</span>
          </div>
          <div className="space-y-2.5">
            {emergencies.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-white/5 bg-navy-950/50 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-bold text-white">
                    {e.type.replaceAll("_", " ")} — Unit {e.ambulance?.vehicleCode}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Assigned: {e.hospital?.name || "Pending Selection"} · Patient: {e.patient?.displayName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                  <StatusBadge value={e.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
