import { api } from "./api";
import { toE164, looksLikePhone } from "../utils/phone";
import type { AuthRole, AuthUser } from "../types/index";

// ── Token helpers ─────────────────────────────────────────────────────────────

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("waitless_access_token", accessToken);
  localStorage.setItem("waitless_refresh_token", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("waitless_access_token");
  localStorage.removeItem("waitless_refresh_token");
  localStorage.removeItem("waitless_user");
}

export function getAccessToken(): string | null {
  return localStorage.getItem("waitless_access_token");
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("waitless_refresh_token");
}

function saveUser(user: AuthUser) {
  if (user) localStorage.setItem("waitless_user", JSON.stringify(user));
  else localStorage.removeItem("waitless_user");
}

export function readStoredUser(): AuthUser {
  try {
    const raw = localStorage.getItem("waitless_user");
    if (raw) return JSON.parse(raw) as AuthUser;
  } catch {
    // corrupted
  }
  return null;
}

// Decode JWT payload without verifying (for reading claims on the client).
function decodeJwt(token: string): { sub: string; role: string; activeOrg?: string | null } {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return { sub: "", role: "" };
  }
}

// Normalize identifier — phone numbers get E.164-formatted.
function normalizeIdentifier(input: string): string {
  return looksLikePhone(input) ? toE164(input) : input.trim();
}

// ── API response type ─────────────────────────────────────────────────────────

type AccountPayload = {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  role: string;
  status: string;
};

type MembershipPayload = {
  kind: "admin" | "doctor" | "receptionist";
  orgId: string;
  branchId?: string;
} | null;

function buildAuthUser(
  account: AccountPayload,
  membership: MembershipPayload,
): AuthUser {
  if (account.role === "patient") {
    return {
      role: "patient",
      profile: {
        id: account.id,
        name: account.fullName,
        phone: account.phone ?? "",
        email: account.email,
        password: "",
        birthdate: "",
      },
    };
  }

  // Worker with no active membership yet — pending state
  if (!membership) {
    return {
      role: "staff",
      profile: {
        id: account.id,
        name: account.fullName,
        phone: account.phone ?? "",
        email: account.email,
      },
    };
  }

  const frontendRole = membership.kind as AuthRole;
  const baseProfile = {
    id: account.id,
    name: account.fullName,
    phone: account.phone ?? "",
    email: account.email,
    password: "",
    orgId: membership.orgId ?? "",
  };

  if (frontendRole === "receptionist") {
    return {
      role: "receptionist",
      profile: { ...baseProfile, branchId: membership.branchId ?? "" },
    };
  }
  if (frontendRole === "doctor") {
    return {
      role: "doctor",
      profile: { ...baseProfile, specialty: "", licenseNumber: "" },
    };
  }
  return { role: frontendRole, profile: baseProfile } as AuthUser;
}

// ── Auth service ──────────────────────────────────────────────────────────────

export const authService = {
  async loginPatient(identifier: string, password: string) {
    const { data } = await api.post<{
      data: { account: AccountPayload; accessToken: string; refreshToken: string };
    }>("/auth/user/login", {
      identifier: normalizeIdentifier(identifier),
      password,
    });
    const { account, accessToken, refreshToken } = data.data;
    saveTokens(accessToken, refreshToken);
    const user = buildAuthUser(account, null);
    saveUser(user);
    return user;
  },

  async loginWorker(identifier: string, password: string) {
    const { data } = await api.post<{
      data: {
        account: AccountPayload;
        accessToken: string;
        refreshToken: string;
        membership: MembershipPayload;
      };
    }>("/auth/worker/login", {
      identifier: normalizeIdentifier(identifier),
      password,
    });
    const { account, accessToken, refreshToken, membership } = data.data;
    saveTokens(accessToken, refreshToken);
    const user = buildAuthUser(account, membership);
    saveUser(user);
    return user;
  },

  async registerPatient(payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    dateOfBirth?: string;
  }) {
    const { data } = await api.post<{ accountId: string; message: string }>(
      "/auth/user/register",
      {
        fullName: payload.fullName,
        email: payload.email.trim().toLowerCase(),
        phone: toE164(payload.phone),
        password: payload.password,
        dateOfBirth: payload.dateOfBirth,
      },
    );
    return data;
  },

  async registerWorker(payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) {
    const { data } = await api.post<{ accountId: string; message: string }>(
      "/auth/worker/register",
      {
        fullName: payload.fullName,
        email: payload.email.trim().toLowerCase(),
        phone: toE164(payload.phone),
        password: payload.password,
      },
    );
    return data;
  },

  // Reload current auth state from the server using the stored access token.
  async me(): Promise<AuthUser> {
    const { data } = await api.get<{
      data: { account: AccountPayload; membership: MembershipPayload };
    }>("/auth/me");
    const { account, membership } = data.data;
    const user = buildAuthUser(account, membership);
    saveUser(user);
    return user;
  },

  async logout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api.post("/auth/logout", { refreshToken });
    } catch {
      // ignore — clear local state regardless
    }
    clearTokens();
  },

  // Try loginPatient first, then loginWorker, return AuthUser on success.
  async login(identifier: string, password: string): Promise<AuthUser> {
    try {
      return await authService.loginPatient(identifier, password);
    } catch (patientErr: unknown) {
      // If patient login fails with 401, try worker login
      const status = (patientErr as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 400) {
        return await authService.loginWorker(identifier, password);
      }
      throw patientErr;
    }
  },
};
