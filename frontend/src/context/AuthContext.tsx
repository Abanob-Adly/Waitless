import { createContext, useContext, useState, useEffect } from "react";
import { authService, readStoredUser, clearTokens } from "../services/authService";
import { toE164 } from "../utils/phone";
import type {
  AuthUser,
  PatientSignupPayload,
  DoctorSignupPayload,
} from "../types/index";

// ── Context type ──────────────────────────────────────────────────────────────

type AuthCtx = {
  authUser: AuthUser;
  isAuthLoading: boolean;
  authError: string | null;
  loginWithCredentials: (identifier: string, password: string) => Promise<boolean>;
  registerPatient: (data: PatientSignupPayload & { email: string }) => Promise<boolean>;
  registerDoctor: (data: DoctorSignupPayload & { email: string }) => Promise<boolean>;
  reloadUser: () => Promise<boolean>;
  logout: () => void;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser>(readStoredUser);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Listen for token refresh failures (fired by api.ts interceptor).
  useEffect(() => {
    function handleForceLogout() {
      setAuthUser(null);
    }
    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, []);

  function clearAuthError() {
    setAuthError(null);
  }

  async function loginWithCredentials(identifier: string, password: string) {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const user = await authService.login(identifier, password);
      setAuthUser(user);
      return true;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Invalid credentials. Please try again.";
      setAuthError(msg);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function registerPatient(data: PatientSignupPayload & { email: string }) {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await authService.registerPatient({
        fullName: data.name,
        email: data.email,
        phone: toE164(data.phone),
        password: data.password,
        dateOfBirth: data.birthdate,
      });
      // Auto-login after successful registration
      const user = await authService.loginPatient(data.email, data.password);
      setAuthUser(user);
      return true;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Sign up failed. Please try again.";
      setAuthError(msg);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function registerDoctor(data: DoctorSignupPayload & { email: string }) {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await authService.registerWorker({
        fullName: data.name,
        email: data.email,
        phone: toE164(data.phone),
        password: data.password,
      });
      // Auto-login after registration — role will be 'staff', no org yet
      const user = await authService.loginWorker(data.email, data.password);
      setAuthUser(user);
      return true;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Sign up failed. Please try again.";
      setAuthError(msg);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function reloadUser(): Promise<boolean> {
    setIsAuthLoading(true);
    try {
      const user = await authService.me();
      setAuthUser(user);
      return true;
    } catch {
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function logout() {
    await authService.logout();
    setAuthUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        authUser,
        isAuthLoading,
        authError,
        loginWithCredentials,
        registerPatient,
        registerDoctor,
        reloadUser,
        logout,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
