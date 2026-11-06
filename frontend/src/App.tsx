import { Navigate, Route, Routes } from "react-router-dom";
import { Protected } from "./components/Protected";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { AmbulanceDashboard } from "./pages/AmbulanceDashboard";
import { HospitalDashboard } from "./pages/HospitalDashboard";
import { TrafficDashboard } from "./pages/TrafficDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { useAuth } from "./lib/auth";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-600 text-sm">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-r-transparent mr-2" />
        <span>Loading Lifeline 360...</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user?.role === "AMBULANCE_DRIVER" ? (
            <Navigate to="/ambulance" replace />
          ) : user?.role === "HOSPITAL_STAFF" ? (
            <Navigate to="/hospital" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route
        path="/ambulance"
        element={
          <Protected roles={["AMBULANCE_DRIVER", "ADMIN"]} noShell>
            <AmbulanceDashboard />
          </Protected>
        }
      />
      <Route
        path="/hospital"
        element={
          <Protected roles={["HOSPITAL_STAFF", "ADMIN"]} noShell>
            <HospitalDashboard />
          </Protected>
        }
      />
      <Route
        path="/traffic"
        element={
          <Protected roles={["TRAFFIC_CONTROL", "ADMIN"]}>
            <TrafficDashboard />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected roles={["ADMIN"]}>
            <AdminDashboard />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
