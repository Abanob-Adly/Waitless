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
    // Fallback: read localStorage directly to handle the post-login race condition
    // where React context hasn't propagated the new auth state before the navigation
    // renders this component. authService.login() writes to localStorage synchronously,
    // so it's always ahead of the React state update.
    try {
      const stored = localStorage.getItem("waitless_user");
      if (stored) {
        const storedUser = JSON.parse(stored) as { role: string };
        if (allowed.includes(storedUser.role as AuthRole)) {
          return <>{children}</>;
        }
      }
    } catch { /* ignore parse errors */ }

    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
