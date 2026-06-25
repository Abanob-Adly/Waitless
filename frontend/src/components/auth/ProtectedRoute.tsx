import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { AuthRole } from "../../types/index";

export function ProtectedRoute({
  role,
  children,
}: {
  role: AuthRole | AuthRole[];
  children: ReactNode;
}) {
  const { authUser } = useAuth();
  const location = useLocation();

  const allowed = Array.isArray(role) ? role : [role];

  if (!authUser || !allowed.includes(authUser.role)) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
