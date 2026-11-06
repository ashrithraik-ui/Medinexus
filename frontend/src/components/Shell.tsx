import { Link, NavLink, useNavigate } from "react-router-dom";
import { Activity, Clock, LogOut, Radio, Shield, User } from "lucide-react";
import { dashboardPath, useAuth } from "../lib/auth";
import { resetSocket } from "../lib/socket";
import { LiveClock } from "./LiveClock";

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-[#060d19] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-50" />
      <div className="pointer-events-none fixed inset-0 hero-glow" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07111f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-teal to-accent-blue shadow-glow">
              <Activity className="text-navy-950" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-extrabold tracking-tight text-white">LIFELINE 360</span>
                <span className="rounded-full bg-teal-400/10 px-2 py-0.2 text-[9px] font-bold text-teal-300">
                  LIVE OPS
                </span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Mysore Central Dispatch
              </p>
            </div>
          </Link>

          {/* Quick Module Navigation */}
          <nav className="hidden items-center gap-2 text-xs font-semibold md:flex">
            <NavLink
              to="/ambulance"
              className={({ isActive }) =>
                `rounded-xl px-3 py-1.5 transition ${
                  isActive ? "bg-accent-teal text-navy-950 shadow-glow" : "text-slate-300 hover:bg-white/5"
                }`
              }
            >
              🚑 Ambulance Ops
            </NavLink>
            <NavLink
              to="/hospital"
              className={({ isActive }) =>
                `rounded-xl px-3 py-1.5 transition ${
                  isActive ? "bg-accent-teal text-navy-950 shadow-glow" : "text-slate-300 hover:bg-white/5"
                }`
              }
            >
              🏥 Hospital Desk
            </NavLink>
            <NavLink
              to="/traffic"
              className={({ isActive }) =>
                `rounded-xl px-3 py-1.5 transition ${
                  isActive ? "bg-accent-teal text-navy-950 shadow-glow" : "text-slate-300 hover:bg-white/5"
                }`
              }
            >
              🚦 Traffic Control
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `rounded-xl px-3 py-1.5 transition ${
                  isActive ? "bg-accent-teal text-navy-950 shadow-glow" : "text-slate-300 hover:bg-white/5"
                }`
              }
            >
              🛡️ Admin
            </NavLink>
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            {/* Real-time AM/PM Live Clock */}
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono font-bold text-teal-300">
              <Clock size={12} className="text-teal-400" />
              <LiveClock showSeconds={true} />
            </div>

            {user && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">{user.name}</span>
                <span className="text-slate-400 text-[11px]">({user.role.replaceAll("_", " ")})</span>
              </div>
            )}
            <button
              onClick={() => {
                logout();
                resetSocket();
                navigate("/");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
