import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Shell } from "./Shell";

export function Protected({
  roles,
  children,
  noShell = false,
}: {
  roles: string[];
  children: React.ReactNode;
  noShell?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-600 font-medium text-sm">
        Loading session…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role) && user.role !== "ADMIN") return <Navigate to="/login" replace />;
  if (noShell) return <>{children}</>;
  return <Shell>{children}</Shell>;
}
