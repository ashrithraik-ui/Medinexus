import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Hospital,
  KeyRound,
  Lock,
  Mail,
  Navigation,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import { dashboardPath, useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { LiveClock } from "../components/LiveClock";

type DashboardRole = "AMBULANCE_DRIVER" | "HOSPITAL_STAFF";

interface DashboardSection {
  id: DashboardRole;
  title: string;
  badge: string;
  subtitle: string;
  defaultEmail: string;
  route: string;
  icon: typeof Navigation;
  accentBg: string;
  accentText: string;
  borderActive: string;
}

const DASHBOARD_SECTIONS: DashboardSection[] = [
  {
    id: "AMBULANCE_DRIVER",
    title: "Ambulance Driver",
    badge: "Ambulance Ops",
    subtitle: "Emergency response, nearest hospital ranking & live green corridor transit",
    defaultEmail: "driver.mysore@lifeline360.demo",
    route: "/ambulance",
    icon: Navigation,
    accentBg: "bg-sky-50",
    accentText: "text-sky-700",
    borderActive: "border-sky-600 ring-2 ring-sky-100",
  },
  {
    id: "HOSPITAL_STAFF",
    title: "Hospital Staff / Management",
    badge: "Hospital Staff",
    subtitle: "Real-time emergency intake alerts, specialist doctors & bed management",
    defaultEmail: "jss.hospital@lifeline360.demo",
    route: "/hospital",
    icon: Hospital,
    accentBg: "bg-emerald-50",
    accentText: "text-emerald-700",
    borderActive: "border-emerald-600 ring-2 ring-emerald-100",
  },
];

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected Dashboard Role
  const roleParam = searchParams.get("role");
  const initialRole: DashboardRole =
    roleParam === "hospital" ? "HOSPITAL_STAFF" : "AMBULANCE_DRIVER";

  const [selectedDashboard, setSelectedDashboard] = useState<DashboardRole>(initialRole);

  // For Ambulance Driver: first show Registration mode, toggleable to Login
  const [authMode, setAuthMode] = useState<"register" | "login">("register");

  // Login form state (Only Email & Password)
  const [loginEmail, setLoginEmail] = useState("driver.mysore@lifeline360.demo");
  const [loginPassword, setLoginPassword] = useState("Demo@12345");

  // Registration form state (Name, Phone, Email, Password, OTP, Hospital)
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [regHospitalId, setRegHospitalId] = useState("");
  const [newHospitalName, setNewHospitalName] = useState("");
  const [newHospitalCity, setNewHospitalCity] = useState("Bangalore");
  const [newHospitalAddress, setNewHospitalAddress] = useState("");
  const [newHospitalPhone, setNewHospitalPhone] = useState("");
  const [newHospitalBeds, setNewHospitalBeds] = useState("20");
  const [hospitalDoctors, setHospitalDoctors] = useState("Dr. Ramesh (Cardiology), Dr. Smitha (Trauma)");

  // Public hospitals list for Hospital Staff registration
  const [hospitals, setHospitals] = useState<{ id: string; name: string; city: string }[]>([]);

  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState("");
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  // Common UI State
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch public hospitals on mount
  useEffect(() => {
    api<{ hospitals: { id: string; name: string; city: string }[] }>("/hospitals/public")
      .then((res) => {
        if (res.hospitals && res.hospitals.length > 0) {
          setHospitals(res.hospitals);
          setRegHospitalId(res.hospitals[0].id);
        }
      })
      .catch((err) => console.warn("Could not load public hospitals:", err));
  }, []);

  // Switch between Ambulance Driver and Hospital Management
  function handleSelectSection(section: DashboardSection) {
    setSelectedDashboard(section.id);
    setError("");
    setSuccess("");
    setOtpSent(false);
    setEnteredOtp("");

    if (section.id === "AMBULANCE_DRIVER") {
      setLoginEmail("driver.mysore@lifeline360.demo");
    } else {
      setLoginEmail(section.defaultEmail);
    }
    setLoginPassword("Demo@12345");

    const paramMap: Record<DashboardRole, string> = {
      AMBULANCE_DRIVER: "ambulance",
      HOSPITAL_STAFF: "hospital",
    };
    setSearchParams({ role: paramMap[section.id] }, { replace: true });
  }

  useEffect(() => {
    if (initialRole === "HOSPITAL_STAFF") {
      setSelectedDashboard("HOSPITAL_STAFF");
      setLoginEmail("jss.hospital@lifeline360.demo");
    } else {
      setSelectedDashboard("AMBULANCE_DRIVER");
      setLoginEmail("driver.mysore@lifeline360.demo");
    }
  }, [initialRole]);

  const activeSection =
    DASHBOARD_SECTIONS.find((s) => s.id === selectedDashboard) || DASHBOARD_SECTIONS[0];
  const ActiveIcon = activeSection.icon;

  // 1. Send OTP to particular email
  async function handleSendOtp() {
    if (!regEmail.trim()) {
      setError("Please enter your email address to receive the verification OTP.");
      return;
    }
    setError("");
    setOtpSending(true);
    setOtpSuccessMsg("");

    try {
      const res = await api<{ ok: boolean; message: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({
          email: regEmail.trim(),
          name: regName.trim() || undefined,
        }),
      });

      setOtpSent(true);
      setOtpSuccessMsg(res.message || `A 6-digit verification OTP code has been sent to ${regEmail}. Please check your inbox.`);
    } catch (err) {
      setOtpSent(true);
      setError(err instanceof Error ? err.message : "Failed to send OTP. Please check the email.");
    } finally {
      setOtpSending(false);
    }
  }

  // 2. Submit Registration (Verifies OTP & writes to backend DB + MongoDB)
  async function onRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!regName.trim() || !regPhone.trim() || !regEmail.trim() || !regPassword.trim()) {
      setError("Please fill out all registration fields.");
      return;
    }

    if (selectedDashboard === "HOSPITAL_STAFF") {
      if (regHospitalId === "__NEW__") {
        if (!newHospitalName.trim()) {
          setError("Please enter the new hospital facility name.");
          return;
        }
      } else if (!regHospitalId) {
        setError("Please select your hospital affiliation or register a new facility.");
        return;
      }
    }

    if (!otpSent) {
      setError("Please click 'Send Verification OTP' to verify your email first.");
      return;
    }

    if (!enteredOtp.trim()) {
      setError("Please enter the 6-digit OTP code sent to your email.");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: selectedDashboard,
        otp: enteredOtp.trim(),
      };

      if (selectedDashboard === "HOSPITAL_STAFF") {
        const selectedHosp = hospitals.find((h) => h.id === regHospitalId);
        const resolvedName = (regHospitalId === "__NEW__" ? newHospitalName.trim() : selectedHosp?.name) || newHospitalName.trim() || "Apollo Hospitals";
        const resolvedPhone = newHospitalPhone.trim() || regPhone.trim();
        const resolvedBeds = Number(newHospitalBeds) || 20;

        payload.hospitalName = resolvedName;
        payload.hospitalPhone = resolvedPhone;
        payload.numberOfBeds = resolvedBeds;
        payload.doctors = hospitalDoctors.trim();

        if (regHospitalId === "__NEW__") {
          payload.newHospitalName = resolvedName;
          payload.newHospitalCity = newHospitalCity.trim();
          payload.newHospitalAddress = newHospitalAddress.trim() || `${resolvedName}, ${newHospitalCity.trim()}`;
          payload.newHospitalPhone = resolvedPhone;
          payload.newHospitalBeds = resolvedBeds;
        } else {
          payload.hospitalId = regHospitalId;
        }
      }

      // Complete Registration (creates User in SQLite and syncs to MongoDB)
      const user = await register(payload);

      setSuccess("Registration verified and complete! Stored in MongoDB & backend.");
      // Redirect directly to the dedicated dashboard
      setTimeout(() => {
        navigate(dashboardPath(user.role));
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  }

  // 3. Submit Login (Email and Password only)
  async function onLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(loginEmail, loginPassword);
      navigate(dashboardPath(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-slate-800">
      <div className="w-full max-w-2xl space-y-6">
        {/* Brand & Portal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm text-xs font-semibold text-slate-700">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIFELINE 360 Emergency Operations</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-slate-600 flex items-center gap-1">
              <Clock size={12} className="text-sky-600" />
              <LiveClock showSeconds={false} />
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Select Dashboard Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Choose your assigned operational department to access your dedicated dashboard.
          </p>
        </div>

        {/* 2 Separate Dashboard Portal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DASHBOARD_SECTIONS.map((section) => {
            const isSelected = selectedDashboard === section.id;
            const Icon = section.icon;

            return (
              <div
                key={section.id}
                onClick={() => handleSelectSection(section)}
                className={`cursor-pointer rounded-2xl border p-5 transition-all duration-150 flex flex-col justify-between ${
                  isSelected
                    ? `bg-white ${section.borderActive} shadow-md`
                    : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white shadow-sm"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${section.accentBg} ${section.accentText}`}>
                      <Icon size={22} />
                    </div>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-900">{section.title}</h3>
                  <span className={`inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider ${section.accentText}`}>
                    {section.badge}
                  </span>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {section.subtitle}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className={isSelected ? section.accentText : "text-slate-400"}>
                    {isSelected ? "Active Section" : "Select Section"}
                  </span>
                  <span className="text-[11px] text-slate-400">➔</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dedicated Auth Box for Selected Dashboard */}
        <div className="max-w-md mx-auto w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${activeSection.accentBg} ${activeSection.accentText}`}>
                <ActiveIcon size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {selectedDashboard === "AMBULANCE_DRIVER" ? "Ambulance Driver Portal" : "Hospital Staff Portal"}
                </p>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {selectedDashboard === "AMBULANCE_DRIVER"
                    ? authMode === "register"
                      ? "Driver Registration"
                      : "Driver Login"
                    : authMode === "register"
                      ? "Hospital Staff Registration"
                      : "Hospital Staff Login"}
                </h2>
              </div>
            </div>

            {/* Toggle between Register and Login for BOTH Ambulance Driver & Hospital Staff */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                  setSuccess("");
                }}
                className={`px-3 py-1.5 rounded-lg transition ${
                  authMode === "register"
                    ? "bg-white text-sky-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                  setSuccess("");
                }}
                className={`px-3 py-1.5 rounded-lg transition ${
                  authMode === "login"
                    ? "bg-white text-sky-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Login
              </button>
            </div>
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium flex items-start gap-2">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REGISTRATION FORM WITH EMAIL OTP & MONGODB STORAGE                        */}
          {/* ========================================================================= */}
          {authMode === "register" && (
            <form onSubmit={onRegisterSubmit} className="space-y-3.5">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {selectedDashboard === "AMBULANCE_DRIVER" ? "Full Name" : "Administrator Full Name"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={
                      selectedDashboard === "AMBULANCE_DRIVER"
                        ? "e.g. Ramesh Kumar"
                        : "e.g. Dr. Priya Sharma / Administrator"
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone size={15} />
                  </span>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  />
                </div>
              </div>

              {/* Hospital Affiliation Dropdown (Only for Hospital Management) */}
              {selectedDashboard === "HOSPITAL_STAFF" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hospital Affiliation
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Hospital size={15} />
                      </span>
                      <select
                        required
                        value={regHospitalId}
                        onChange={(e) => setRegHospitalId(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition cursor-pointer appearance-none"
                      >
                        <option value="">-- Select Existing Hospital Facility --</option>
                        {hospitals.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.city})
                          </option>
                        ))}
                        <option value="__NEW__">➕ Register New Hospital Facility...</option>
                      </select>
                      <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Hospital Staff & Facility Data Collection (Stored in MongoDB) */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">
                      Hospital Facility & Staff Data (Stored in MongoDB)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {regHospitalId === "__NEW__" && (
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Hospital Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={newHospitalName}
                            onChange={(e) => setNewHospitalName(e.target.value)}
                            placeholder="e.g. Apollo Hospitals Bannerghatta Road"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          Hospital Phone / Emergency Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={newHospitalPhone}
                          onChange={(e) => setNewHospitalPhone(e.target.value)}
                          placeholder="e.g. 080-26304050"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          Number of Emergency Beds *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          required
                          value={newHospitalBeds}
                          onChange={(e) => setNewHospitalBeds(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          Doctors on Duty / Assigned Specialists *
                        </label>
                        <input
                          type="text"
                          required
                          value={hospitalDoctors}
                          onChange={(e) => setHospitalDoctors(e.target.value)}
                          placeholder="e.g. Dr. Ramesh (Cardiology), Dr. Smitha (Trauma Surgeon)"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      {regHospitalId === "__NEW__" && (
                        <>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              City *
                            </label>
                            <select
                              value={newHospitalCity}
                              onChange={(e) => setNewHospitalCity(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="Bangalore">Bangalore</option>
                              <option value="Mysore">Mysore</option>
                              <option value="Mangalore">Mangalore</option>
                              <option value="Hubli">Hubli</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              Address
                            </label>
                            <input
                              type="text"
                              value={newHospitalAddress}
                              onChange={(e) => setNewHospitalAddress(e.target.value)}
                              placeholder="Street, Area, Landmark"
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Email Address + Send OTP Button */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail size={15} />
                    </span>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        setOtpSent(false);
                        setIsOtpVerified(false);
                      }}
                      placeholder={
                        selectedDashboard === "AMBULANCE_DRIVER"
                          ? "driver@gmail.com"
                          : "admin@hospital.org"
                      }
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={otpSending || !regEmail.includes("@")}
                    onClick={handleSendOtp}
                    className="px-3.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                  >
                    {otpSending ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <Send size={12} />
                        <span>{otpSent ? "Resend OTP" : "Send OTP"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* OTP Delivery Alert Banner */}
              {otpSent && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-semibold text-sky-900 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-sky-600 shrink-0" />
                    <span>{otpSuccessMsg || `Verification code sent to ${regEmail}`}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 pl-5">
                    Please check your email inbox (and spam folder) for the 6-digit verification code.
                  </p>
                </div>
              )}

              {/* 6-Digit OTP Input */}
              {otpSent && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enter 6-Digit Verification OTP
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound size={15} />
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value.trim())}
                      placeholder="e.g. 123456"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={15} />
                  </span>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  />
                </div>
              </div>

              {/* Registration & MongoDB sync submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                {loading ? (
                  <span>Registering & Storing in MongoDB...</span>
                ) : (
                  <span>
                    {selectedDashboard === "AMBULANCE_DRIVER"
                      ? "Verify OTP & Register Ambulance Driver"
                      : "Verify OTP & Register Hospital Staff"}
                  </span>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setError("");
                  }}
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  {selectedDashboard === "AMBULANCE_DRIVER"
                    ? "Already registered? Switch to Driver Login"
                    : "Already registered? Switch to Hospital Staff Login"}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* LOGIN FORM (ONLY EMAIL AND PASSWORD)                                      */}
          {/* ========================================================================= */}
          {authMode === "login" && (
            <form onSubmit={onLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={
                      selectedDashboard === "AMBULANCE_DRIVER"
                        ? "driver.mysore@lifeline360.demo"
                        : "jss.hospital@lifeline360.demo"
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                {loading ? (
                  <span>Logging in...</span>
                ) : (
                  <span>
                    Login to {selectedDashboard === "AMBULANCE_DRIVER" ? "Ambulance Driver" : "Hospital Staff"} Dashboard
                  </span>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setError("");
                  }}
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  {selectedDashboard === "AMBULANCE_DRIVER"
                    ? "Need a new driver account? Register with Email OTP"
                    : "Need a new hospital staff account? Register with Email OTP"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
