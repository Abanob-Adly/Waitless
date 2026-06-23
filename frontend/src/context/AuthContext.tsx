import { createContext, useContext, useState } from "react";
import { signupPatient, signupDoctor, loginUser } from "../services/mockApi";
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
  loginWithCredentials: (phone: string, password: string) => Promise<boolean>;
  registerPatient: (data: PatientSignupPayload) => Promise<boolean>;
  registerDoctor: (data: DoctorSignupPayload) => Promise<boolean>;
  logout: () => void;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

// ── LocalStorage key ──────────────────────────────────────────────────────────

const LS_KEY = "waitless_auth";

function readStoredAuth(): AuthUser {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AuthUser;
  } catch {
    // corrupted storage — ignore
  }
  return null;
}

function writeStoredAuth(user: AuthUser) {
  if (user) {
    localStorage.setItem(LS_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser>(readStoredAuth);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  function clearAuthError() {
    setAuthError(null);
  }

  async function loginWithCredentials(phone: string, password: string) {
    setIsAuthLoading(true);
    setAuthError(null);
    const result = await loginUser(phone, password);
    setIsAuthLoading(false);
    if (result.success && result.user) {
      setAuthUser(result.user);
      writeStoredAuth(result.user);
      return true;
    }
    setAuthError(result.error ?? "Login failed. Please try again.");
    return false;
  }

  async function registerPatient(data: PatientSignupPayload) {
    setIsAuthLoading(true);
    setAuthError(null);
    const result = await signupPatient(data);
    setIsAuthLoading(false);
    if (result.success && result.profile) {
      const user: AuthUser = { role: "patient", profile: result.profile };
      setAuthUser(user);
      writeStoredAuth(user);
      return true;
    }
    setAuthError(result.error ?? "Sign up failed. Please try again.");
    return false;
  }

  async function registerDoctor(data: DoctorSignupPayload) {
    setIsAuthLoading(true);
    setAuthError(null);
    const result = await signupDoctor(data);
    setIsAuthLoading(false);
    if (result.success && result.profile) {
      const user: AuthUser = { role: "doctor", profile: result.profile };
      setAuthUser(user);
      writeStoredAuth(user);
      return true;
    }
    setAuthError(result.error ?? "Sign up failed. Please try again.");
    return false;
  }

  function logout() {
    setAuthUser(null);
    writeStoredAuth(null);
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
