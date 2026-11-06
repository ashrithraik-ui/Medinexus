import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Ambulance,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Hospital,
  MapPin,
  MapPinned,
  Phone,
  Play,
  Radio,
  RadioTower,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  TrafficCone,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import { MapView } from "../components/MapView";
import { MYSORE_DEMO_ROUTE } from "../lib/types";
import { useAuth, dashboardPath } from "../lib/auth";

export function Landing() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [activeCallId, setActiveCallId] = useState(1);
  const [corridorStep, setCorridorStep] = useState(2);
  const [corridorPlaying, setCorridorPlaying] = useState(false);
  const [authLoading, setAuthLoading] = useState<string | null>(null);

  // Demo Mysore Corridor Intersections
  const corridorSignals = [
    { id: 1, code: "SIG-01", name: "Palace North Gate", dist: "Crossed", status: "NORMAL" },
    { id: 2, code: "SIG-02", name: "Irwin Road Junction", dist: "140 m", status: "EMERGENCY_PRIORITY" },
    { id: 3, code: "SIG-03", name: "Ayurvedic Hospital Circle", dist: "480 m", status: "STANDBY" },
    { id: 4, code: "SIG-04", name: "Railway Station Road", dist: "890 m", status: "STANDBY" },
    { id: 5, code: "SIG-05", name: "Ramaswamy Circle", dist: "1.4 km", status: "STANDBY" },
    { id: 6, code: "SIG-06", name: "JSS Hospital Approach", dist: "2.1 km", status: "STANDBY" },
  ];

  // Auto-cycle corridor simulation in the demo widget if playing
  useEffect(() => {
    if (!corridorPlaying) return;
    const timer = setInterval(() => {
      setCorridorStep((s) => (s >= corridorSignals.length ? 1 : s + 1));
    }, 2000);
    return () => clearInterval(timer);
  }, [corridorPlaying]);

  async function handleQuickLogin(email: string) {
    setAuthLoading(email);
    try {
      const user = await login(email, "Demo@12345");
      navigate(dashboardPath(user.role));
    } catch {
      navigate("/login");
    } finally {
      setAuthLoading(null);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#040914] text-slate-100 selection:bg-teal-400 selection:text-navy-950">
      {/* Background Cyber Grid & Luminous Aurora Atmosphere */}
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-50" />
      <div className="pointer-events-none fixed inset-0 hero-glow" />

      {/* 1. Transparent Glassmorphism Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#040914]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-teal via-accent-blue to-indigo-600 p-[1px] shadow-glow transition group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-navy-950">
                <Activity className="text-accent-teal" size={20} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-extrabold tracking-tight text-white">LIFELINE 360</span>
                <span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-300">
                  SMART OS
                </span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Emergency & Green Corridor Orchestration
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-300 md:flex">
            <a href="#platform-preview" className="transition hover:text-teal-300 flex items-center gap-1">
              <span>Platform</span>
            </a>
            <a href="#solutions" className="transition hover:text-teal-300 flex items-center gap-1">
              <span>Solutions</span>
            </a>
            <a href="#how" className="transition hover:text-teal-300 flex items-center gap-1">
              <span>How It Works</span>
            </a>
            <a href="#corridor-sim" className="transition hover:text-teal-300 flex items-center gap-1">
              <span>Green Corridor</span>
            </a>
            <a href="#about" className="transition hover:text-teal-300 flex items-center gap-1">
              <span>About</span>
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            >
              Login
            </Link>
            <a
              href="#evaluator-access"
              className="group inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-xs font-bold text-navy-950 shadow-glow transition hover:bg-slate-100 hover:shadow-glow-blue"
            >
              <span>Get Started</span>
              <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. Full-Screen Cinematic Hero Section */}
      <main className="relative mx-auto max-w-7xl px-6 pt-16 pb-28">
        <div className="mx-auto max-w-4xl text-center">
          {/* Subtle Technology Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-bold text-teal-300 backdrop-blur-md shadow-glow">
            <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            <span>MYSORE SMART CITY EMERGENCY TRIAGE PROTOTYPE</span>
          </div>

          {/* Main Headline (Exact Required Text with Cinematic Styling) */}
          <h1 className="mt-8 font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl md:leading-[1.12]">
            Faster Emergency Response.
            <span className="block text-slate-200">Smarter Hospitals.</span>
            <span className="block font-serif italic font-normal tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-cyan-300 to-sky-300">
              Clearer Roads.
            </span>
          </h1>

          {/* Subtitle (Exact Required Text) */}
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg leading-relaxed">
            An intelligent emergency response platform connecting ambulances, hospitals and traffic systems to coordinate life-saving journeys.
          </p>

          {/* Primary & Secondary Hero Action Buttons */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#platform-preview"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-navy-950 shadow-glow transition hover:bg-slate-100 hover:shadow-glow-blue"
            >
              <span>Explore Platform</span>
              <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a
              href="#corridor-sim"
              className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/[0.12] hover:text-white"
            >
              <Play size={15} className="text-teal-300 fill-teal-300" />
              <span>Watch Live Demo</span>
            </a>
          </div>
        </div>

        {/* 3. Large Integrated Application Preview (Primary Reference Recreation) */}
        <div id="platform-preview" className="mt-16 scroll-mt-28">
          <div className="overflow-hidden rounded-3xl border border-white/[0.15] bg-[#071324]/90 shadow-glow-card backdrop-blur-2xl">
            {/* Console Window Header Bar */}
            <div className="flex flex-wrap items-center justify-between border-b border-white/[0.08] bg-navy-950/90 px-6 py-3.5 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="hidden h-4 w-[1px] bg-white/10 sm:block" />
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIFELINE 360 // CENTRAL DISPATCH ENGINE</span>
                </div>
              </div>

              {/* Console Center Navigation Modules */}
              <div className="hidden items-center gap-1.5 md:flex">
                <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 font-semibold text-white">
                  <Phone size={13} className="text-teal-300" />
                  <span>Incidents (3)</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-slate-400">
                  <Ambulance size={13} />
                  <span>Units (4)</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-slate-400">
                  <TrafficCone size={13} />
                  <span>Corridors (Active)</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-slate-400">
                  <Hospital size={13} />
                  <span>ER Capacity</span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full bg-teal-500/10 px-3 py-0.5 text-[11px] font-semibold text-teal-300">
                  Mysore Central Control
                </span>
                <Bell size={14} className="text-slate-400" />
              </div>
            </div>

            {/* Split Workspace: Left Real-time Incidents Sidebar + Right Dark Tactical Map */}
            <div className="grid lg:grid-cols-12 min-h-[560px]">
              {/* Left Column: Incident List Sidebar */}
              <div className="border-r border-white/[0.08] bg-[#06101e]/90 p-5 lg:col-span-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">Active Emergencies</span>
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        3 TRACKED
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Telemetry: Live</span>
                  </div>

                  <div className="mt-3">
                    <input
                      type="text"
                      readOnly
                      value="Search calls, units, or signals..."
                      className="w-full rounded-xl border border-white/10 bg-navy-900/60 px-3 py-2 text-xs text-slate-400"
                    />
                  </div>

                  {/* Incident Queue */}
                  <div className="mt-3.5 space-y-2.5">
                    {/* Call 1: Road Accident */}
                    <div
                      onClick={() => setActiveCallId(1)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        activeCallId === 1
                          ? "border-teal-400/50 bg-teal-500/10 shadow-glow"
                          : "border-white/[0.06] bg-navy-900/40 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
                            <Siren size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">(0821) 254-8330</p>
                            <p className="text-[11px] text-slate-400">Palace North Gate · Pos #04</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 animate-pulse">
                          01:24
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                          Road accident
                        </span>
                        <span className="rounded-md bg-teal-500/20 px-2 py-0.5 text-[10px] font-medium text-teal-300 font-mono">
                          KA-09-G-3601
                        </span>
                        <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          JSS Hospital Accepted
                        </span>
                      </div>
                    </div>

                    {/* Call 2: Cardiac Emergency */}
                    <div
                      onClick={() => setActiveCallId(2)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        activeCallId === 2
                          ? "border-teal-400/50 bg-teal-500/10 shadow-glow"
                          : "border-white/[0.06] bg-navy-900/40 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/20 text-orange-300">
                            <Activity size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">(0821) 256-8888</p>
                            <p className="text-[11px] text-slate-400">Kuvempunagar · Pos #12</p>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">3:17 PM</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                          Heart Attack
                        </span>
                        <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                          Apollo Cath Lab
                        </span>
                      </div>
                    </div>

                    {/* Call 3: Maternity Emergency */}
                    <div
                      onClick={() => setActiveCallId(3)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        activeCallId === 3
                          ? "border-teal-400/50 bg-teal-500/10 shadow-glow"
                          : "border-white/[0.06] bg-navy-900/40 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                            <Hospital size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">(0821) 242-1100</p>
                            <p className="text-[11px] text-slate-400">Sayyaji Rao Rd · Pos #08</p>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">3:15 PM</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                          Pregnancy Emergency
                        </span>
                        <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          K.R. Hospital Desk
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Telephony Status Strip */}
                <div className="mt-4 rounded-xl border border-white/10 bg-navy-950/70 p-3 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between text-teal-300 font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Radio size={13} />
                      <span>Telematics Stream</span>
                    </span>
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>
                  Connected to Mysore Smart City Traffic Control simulation feed.
                </div>
              </div>

              {/* Right Column: Dark Tactical Map with Tactical Popover Card */}
              <div className="relative lg:col-span-8 flex flex-col">
                <div className="relative h-full min-h-[540px] w-full">
                  {/* Floating Map Controls Overlay (Prepared Reference UI Pattern) */}
                  <div className="absolute top-4 left-4 right-4 z-[999] flex items-center justify-between gap-3 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-[#071324]/85 px-3 py-1.5 backdrop-blur-md shadow-lg">
                      <Search size={13} className="text-teal-400" />
                      <input
                        type="text"
                        readOnly
                        value="Search the area"
                        className="bg-transparent text-xs text-slate-300 placeholder-slate-500 outline-none w-36"
                      />
                    </div>
                    <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-[#071324]/85 p-1 backdrop-blur-md shadow-lg text-[11px] font-semibold text-slate-300">
                      <span className="rounded-lg bg-white/10 px-2.5 py-1 text-white">Map</span>
                      <span className="px-2.5 py-1 text-slate-400">Satellite</span>
                      <span className="px-2 py-1 text-slate-400 border-l border-white/10 font-mono text-[10px]">⛶</span>
                    </div>
                  </div>

                  <MapView
                    center={[12.318, 76.643]}
                    ambulance={{ lat: 12.3124, lng: 76.6506, label: "KA-09-G-3601 (En Route)" }}
                    destination={{ lat: 12.3395, lng: 76.6228, name: "JSS Hospital Mysore" }}
                    route={MYSORE_DEMO_ROUTE}
                    className="h-full w-full rounded-none"
                  />

                  {/* Tactical Popover Incident Card (Matching the Reference Screenshot) */}
                  <div className="absolute bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:max-w-md z-[1000] rounded-2xl border border-white/20 bg-[#071324]/95 p-5 shadow-2xl backdrop-blur-2xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-bold text-white">(0821) 254-8330</p>
                          <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            01:24
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Ambulance KA-09-G-3601 · Driver Sanjay · Mysore Palace North Gate
                        </p>
                      </div>
                      <span className="rounded-full bg-teal-400/10 px-2.5 py-0.5 text-[10px] font-bold text-teal-300 font-mono">
                        ETA 4 MIN
                      </span>
                    </div>

                    <div className="mt-3.5 text-xs text-slate-300 leading-relaxed rounded-xl bg-navy-950/80 p-3.5 border border-white/10 space-y-1.5">
                      <p className="font-semibold text-white">Active Case Triage:</p>
                      <p className="text-slate-300">
                        Road accident near Mysore Palace. Suspected lower extremity fracture. Orthopedic surgical bay and 5 emergency beds reserved at{" "}
                        <strong className="text-teal-300">JSS Hospital</strong>.
                      </p>
                      <p className="mt-2 text-teal-300 font-mono text-[11px] flex items-center gap-1.5">
                        <TrafficCone size={13} />
                        <span>Green Corridor: SIG-02 (Irwin Rd) ARMED & GREEN.</span>
                      </p>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        to="/login"
                        className="flex-1 rounded-xl bg-accent-teal py-2.5 text-center text-xs font-bold text-navy-950 transition hover:bg-teal-300 shadow-md"
                      >
                        Open Triage Desk
                      </Link>
                      <Link
                        to="/login"
                        className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-center text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                      >
                        Corridor Telemetry
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Four Core Platform Pillars */}
        <section id="solutions" className="mt-32 scroll-mt-24">
          <div className="text-center">
            <span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-3.5 py-1 text-xs font-bold text-teal-300">
              INTELLIGENT HEALTHCARE GRID
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">
              Engineered for Critical Response Times
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-400">
              Four synchronized subsystems eliminating friction from roadside casualty pickup to ER admission.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Pillar 1: Smart Hospital Selection */}
            <div className="glass-panel p-6 flex flex-col justify-between transition-all hover:border-teal-400/40 hover:shadow-glow">
              <div>
                <div className="mb-4 inline-flex rounded-xl bg-teal-500/15 p-3 text-teal-300">
                  <Hospital size={22} />
                </div>
                <h3 className="font-bold text-white text-base">Smart Hospital Selection</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Rule-based suitability scoring ranks facilities based on immediate clinical readiness, verified ICU beds, and on-duty specialists (orthopedic, cardiac, maternity).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-teal-300 font-semibold">
                <span>Multi-factor clinical matching</span>
                <ChevronRight size={13} />
              </div>
            </div>

            {/* Pillar 2: Real-Time Ambulance Tracking */}
            <div className="glass-panel p-6 flex flex-col justify-between transition-all hover:border-teal-400/40 hover:shadow-glow">
              <div>
                <div className="mb-4 inline-flex rounded-xl bg-blue-500/15 p-3 text-blue-300">
                  <Ambulance size={22} />
                </div>
                <h3 className="font-bold text-white text-base">Real-Time Ambulance Tracking</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  GPS breadcrumb telemetry streams coordinates directly to hospital desks and traffic controllers, calculating millisecond-accurate ETA and transit speeds.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-blue-300 font-semibold">
                <span>GPS & simulation fallback</span>
                <ChevronRight size={13} />
              </div>
            </div>

            {/* Pillar 3: Intelligent Green Corridor */}
            <div className="glass-panel p-6 flex flex-col justify-between transition-all hover:border-teal-400/40 hover:shadow-glow">
              <div>
                <div className="mb-4 inline-flex rounded-xl bg-amber-500/15 p-3 text-amber-300">
                  <TrafficCone size={22} />
                </div>
                <h3 className="font-bold text-white text-base">Intelligent Green Corridor</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Sequential intersection preemption activates a safe green phase when approaching within 350 meters, immediately restoring normal cycles once crossed.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-amber-300 font-semibold">
                <span>Safe sequential transitions</span>
                <ChevronRight size={13} />
              </div>
            </div>

            {/* Pillar 4: Advance Hospital Notifications */}
            <div className="glass-panel p-6 flex flex-col justify-between transition-all hover:border-teal-400/40 hover:shadow-glow">
              <div>
                <div className="mb-4 inline-flex rounded-xl bg-purple-500/15 p-3 text-purple-300">
                  <RadioTower size={22} />
                </div>
                <h3 className="font-bold text-white text-base">Advance Hospital Notifications</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Socket.IO WebSocket alerts deliver patient vitals, injury classification, and ETA directly to emergency department staff before the ambulance arrives.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-purple-300 font-semibold">
                <span>Instant intake pre-alerts</span>
                <ChevronRight size={13} />
              </div>
            </div>
          </div>
        </section>

        {/* 5. Interactive Green Corridor Visualizer Section */}
        <section id="corridor-sim" className="mt-32 scroll-mt-24">
          <div className="glass-panel p-8 sm:p-10 border-teal-500/30">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <span className="rounded-full bg-teal-400/10 px-3 py-1 text-xs font-bold text-teal-300">
                  SIMULATION WORKFLOW // MYSORE CORRIDOR
                </span>
                <h2 className="mt-3 font-display text-2xl font-extrabold text-white sm:text-3xl">
                  Sequential Green Corridor Simulation
                </h2>
                <p className="mt-1 text-xs text-slate-400 max-w-2xl leading-relaxed">
                  Only the upcoming signal receives emergency priority. Once the ambulance clears the intersection (&lt;40m),
                  the signal returns to its normal cycle and the next intersection is armed.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCorridorPlaying(!corridorPlaying)}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-md ${
                    corridorPlaying
                      ? "bg-rose-500 text-white"
                      : "bg-accent-teal text-navy-950 hover:bg-teal-300"
                  }`}
                >
                  <Play size={14} />
                  <span>{corridorPlaying ? "Pause Animation" : "Auto-Cycle Corridor"}</span>
                </button>
                <button
                  onClick={() => setCorridorStep((s) => (s >= corridorSignals.length ? 1 : s + 1))}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                >
                  Advance Next Signal ➔
                </button>
              </div>
            </div>

            {/* Signal Progression Cards */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {corridorSignals.map((sig) => {
                const isActive = sig.id === corridorStep;
                const isCrossed = sig.id < corridorStep;
                return (
                  <div
                    key={sig.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isActive
                        ? "border-teal-400 bg-teal-500/15 shadow-glow"
                        : isCrossed
                        ? "border-white/5 bg-navy-950/40 opacity-60"
                        : "border-white/10 bg-navy-950/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-300">{sig.code}</span>
                      <span
                        className={`flex h-3 w-3 rounded-full ${
                          isActive
                            ? "bg-emerald-400 animate-ping"
                            : isCrossed
                            ? "bg-slate-600"
                            : "bg-amber-400"
                        }`}
                      />
                    </div>
                    <p className="mt-2 text-xs font-bold text-white leading-tight">{sig.name}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        {isCrossed ? "Crossed" : isActive ? "Target" : "Upcoming"}
                      </span>
                      <span
                        className={`font-semibold ${
                          isActive ? "text-teal-300 font-bold" : isCrossed ? "text-slate-400" : "text-amber-300"
                        }`}
                      >
                        {isActive ? "EMERGENCY GREEN" : isCrossed ? "Normal Cycle" : "Standby"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-navy-950/80 px-5 py-3 text-xs text-slate-300 border border-white/5">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-slate-400">Approach Threshold: </span>
                  <strong className="text-white">350 meters</strong>
                </div>
                <div>
                  <span className="text-slate-400">Clearance Threshold: </span>
                  <strong className="text-white">40 meters</strong>
                </div>
                <div>
                  <span className="text-slate-400">Safety Policy: </span>
                  <strong className="text-teal-300">Sequential Only (No Simultaneous Greens)</strong>
                </div>
              </div>
              <p className="text-orange-300 font-medium">
                Simulation mode for hackathon demonstration. Unconnected to live municipal controllers.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Evaluator Pass & Dashboard Launch Hub */}
        <section id="evaluator-access" className="mt-32 scroll-mt-24">
          <div className="glass-panel p-8 sm:p-10">
            <div className="text-center">
              <span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-3.5 py-1 text-xs font-bold text-teal-300">
                EVALUATION ACCESS PASS
              </span>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-white">
                Experience All Four Operational Dashboards
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Click any dashboard below to log in instantly with pre-seeded demo credentials.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  role: "Ambulance Driver",
                  email: "driver.mysore@lifeline360.demo",
                  icon: Ambulance,
                  desc: "Log emergency triage, evaluate nearby hospitals, select intake destination, and start live route simulation.",
                  btnColor: "bg-teal-400 text-navy-950 hover:bg-teal-300",
                },
                {
                  role: "Hospital Intake Desk",
                  email: "jss.hospital@lifeline360.demo",
                  icon: Hospital,
                  desc: "Accept incoming ambulance dispatch, manage on-duty specialist doctors, and adjust emergency bed counts.",
                  btnColor: "bg-blue-500 text-white hover:bg-blue-400",
                },
                {
                  role: "Traffic Control",
                  email: "traffic.mysore@lifeline360.demo",
                  icon: TrafficCone,
                  desc: "Monitor live corridor preemption, inspect signal distance telemetry, and observe safe sequential transitions.",
                  btnColor: "bg-amber-400 text-navy-950 hover:bg-amber-300",
                },
                {
                  role: "System Admin",
                  email: "admin@lifeline360.demo",
                  icon: ShieldCheck,
                  desc: "Review aggregate hospital availability charts, inspect audit logs, and administer system users.",
                  btnColor: "bg-white text-navy-950 hover:bg-slate-200",
                },
              ].map((card) => (
                <div key={card.role} className="card p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-teal-300">
                        <card.icon size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">{card.role}</h3>
                        <p className="text-[11px] font-mono text-slate-400">{card.email}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-300 leading-relaxed">{card.desc}</p>
                  </div>

                  <button
                    disabled={authLoading === card.email}
                    onClick={() => handleQuickLogin(card.email)}
                    className={`mt-5 w-full rounded-xl py-2.5 text-xs font-bold transition shadow-md flex items-center justify-center gap-1.5 ${card.btnColor}`}
                  >
                    {authLoading === card.email ? (
                      <span>Launching Session...</span>
                    ) : (
                      <>
                        <span>Enter Dashboard</span>
                        <ArrowUpRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              Preset demo credentials: password for all roles is <code className="text-teal-300 font-mono">Demo@12345</code>
            </p>
          </div>
        </section>

        {/* 7. About & Safety Architecture Section */}
        <section id="about" className="mt-28 scroll-mt-24">
          <div className="glass-panel p-8 text-xs text-slate-300 border-white/10 space-y-3">
            <h3 className="font-bold text-white text-base">About LIFELINE 360 Architecture & Ethical Safety</h3>
            <p className="leading-relaxed">
              LIFELINE 360 is engineered as a full-stack smart emergency coordination system. To uphold municipal safety standards, traffic preemption is implemented as an intelligent, sequential software simulation decoupled from live public infrastructure via the <code className="text-teal-300">TrafficControllerPort</code> architecture. Real-world ATCS integration requires authorized agency controllers, failsafe fallbacks, and physical verification.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#030710] px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <span>LIFELINE 360 · Smart Emergency OS · Mysore Hackathon Edition</span>
          </div>
          <div>
            Built with React, Express, Prisma, Socket.IO & Leaflet. All traffic priority is simulated.
          </div>
        </div>
      </footer>
    </div>
  );
}
