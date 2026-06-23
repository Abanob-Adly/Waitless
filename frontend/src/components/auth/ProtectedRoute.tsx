import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { AuthRole } from "../../types/index";

export function ProtectedRoute({
  role,
  children,
}: {
  role: AuthRole;
  children: ReactNode;
}) {
  const { authUser } = useAuth();
  const location = useLocation();

  if (!authUser || authUser.role !== role) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
