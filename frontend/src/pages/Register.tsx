import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { dashboardPath, useAuth } from "../lib/auth";
import { api } from "../lib/api";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "AMBULANCE_DRIVER",
    hospitalId: "",
    vehicleCode: "",
  });

  useEffect(() => {
    api<{ hospitals: { id: string; name: string }[] }>("/hospitals/public")
      .then((d) => setHospitals(d.hospitals))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await register({
        ...form,
        hospitalId: form.role === "HOSPITAL_STAFF" ? form.hospitalId : undefined,
      });
      navigate(dashboardPath(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-5 py-12 bg-[#040914]">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-50" />
      <div className="pointer-events-none fixed inset-0 hero-glow" />

      <div className="relative z-10 w-full max-w-lg">
        <Link to="/" className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-teal to-accent-blue shadow-glow">
            <Activity className="text-navy-950" size={20} />
          </div>
          <div>
            <span className="font-display text-xl font-extrabold text-white">LIFELINE 360</span>
            <p className="text-[10px] uppercase tracking-[0.2em] text-teal-300">New Agency Account</p>
          </div>
        </Link>

        <div className="rounded-3xl border border-white/[0.12] bg-[#071324]/90 p-8 shadow-glow-card backdrop-blur-2xl">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-white">Register Agency User</h1>
            <p className="mt-1 text-xs text-slate-400">
              Create an operator account for emergency dispatch or clinical coordination.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Full Name</label>
              <input
                required
                type="text"
                placeholder="Dr. / Officer / Driver Name"
                className="mt-1 w-full rounded-xl border border-white/10 bg-navy-900/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <input
                required
                type="email"
                placeholder="name@agency.mysore.gov"
                className="mt-1 w-full rounded-xl border border-white/10 bg-navy-900/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <input
                required
                type="password"
                placeholder="At least 8 characters"
                className="mt-1 w-full rounded-xl border border-white/10 bg-navy-900/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Operational Role</label>
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-navy-900 px-3.5 py-2.5 text-xs text-white focus:border-teal-400 focus:outline-none"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="AMBULANCE_DRIVER">Ambulance Driver (Paramedic)</option>
                <option value="HOSPITAL_STAFF">Hospital Intake Staff</option>
                <option value="TRAFFIC_CONTROL">Traffic Control Officer</option>
              </select>
            </div>

            {form.role === "HOSPITAL_STAFF" && (
              <div>
                <label className="text-xs font-semibold text-slate-300">Assigned Hospital</label>
                <select
                  required
                  className="mt-1 w-full rounded-xl border border-white/10 bg-navy-900 px-3.5 py-2.5 text-xs text-white focus:border-teal-400 focus:outline-none"
                  value={form.hospitalId}
                  onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}
                >
                  <option value="">Select hospital facility</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.role === "AMBULANCE_DRIVER" && (
              <div>
                <label className="text-xs font-semibold text-slate-300">Vehicle Registration Code (Optional)</label>
                <input
                  placeholder="e.g. KA-09-G-4421"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-navy-900/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none"
                  value={form.vehicleCode}
                  onChange={(e) => setForm({ ...form, vehicleCode: e.target.value })}
                />
              </div>
            )}

            {error && <p className="text-xs text-rose-300 font-medium">{error}</p>}

            <button
              disabled={loading}
              className="w-full rounded-xl bg-accent-teal py-3 text-xs font-bold text-navy-950 shadow-glow transition hover:bg-teal-300 disabled:opacity-50"
            >
              {loading ? "Registering Session…" : "Complete Registration"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Already registered?{" "}
            <Link to="/login" className="font-semibold text-teal-300 hover:underline">
              Sign in to operations
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
