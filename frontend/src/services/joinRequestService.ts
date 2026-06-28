import { api } from "./api";

// ── Types ──────────────────────────────────────────────────────────────────────

export type JoinRequest = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  specialties: string[];
  bio: string;
  licenseNumber: string;
  message: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  createdAt: string;
};

export type PendingInvitation = {
  id: string;
  kind: "admin" | "doctor" | "receptionist";
  inviteToken: string;
  inviteEmail: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
};

export type AdminJoinRequest = {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  accountPhone: string;
  specialties: string[];
  bio: string;
  licenseNumber: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type ClinicSearchResult = {
  id: string;
  name: string;
  type: string;
  description: string;
  branchCount: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function adaptJoinRequest(r: Record<string, unknown>): JoinRequest {
  const org = (r.organization as Record<string, unknown>) ?? {};
  return {
    id: String(r._id ?? r.id),
    organizationId: String(org._id ?? org.id ?? ""),
    organizationName: String(org.name ?? ""),
    organizationType: String(org.type ?? ""),
    specialties: (r.specialties as string[]) ?? [],
    bio: String(r.bio ?? ""),
    licenseNumber: String(r.licenseNumber ?? ""),
    message: String(r.message ?? ""),
    status: (r.status as JoinRequest["status"]) ?? "pending",
    createdAt: String(r.createdAt ?? ""),
  };
}

function adaptInvitation(m: Record<string, unknown>): PendingInvitation {
  const org = (m.organization as Record<string, unknown>) ?? {};
  return {
    id: String(m._id ?? m.id),
    kind: (m.kind as PendingInvitation["kind"]) ?? "doctor",
    inviteToken: String(m.inviteToken ?? ""),
    inviteEmail: String(m.inviteEmail ?? ""),
    organizationId: String(org._id ?? org.id ?? ""),
    organizationName: String(org.name ?? ""),
    createdAt: String(m.createdAt ?? ""),
  };
}

function adaptAdminRequest(r: Record<string, unknown>): AdminJoinRequest {
  const account = (r.account as Record<string, unknown>) ?? {};
  return {
    id: String(r._id ?? r.id),
    accountId: String(account._id ?? account.id ?? ""),
    accountName: String(account.fullName ?? ""),
    accountEmail: String(account.email ?? ""),
    accountPhone: String(account.phone ?? ""),
    specialties: (r.specialties as string[]) ?? [],
    bio: String(r.bio ?? ""),
    licenseNumber: String(r.licenseNumber ?? ""),
    message: String(r.message ?? ""),
    status: (r.status as AdminJoinRequest["status"]) ?? "pending",
    createdAt: String(r.createdAt ?? ""),
  };
}

// ── Doctor-facing ──────────────────────────────────────────────────────────────

export async function searchClinics(query: string): Promise<ClinicSearchResult[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>("/marketplace/orgs", {
    params: { q: query, limit: 10 },
  });
  const list = Array.isArray(res.data.data) ? res.data.data : [];
  return list.map((o) => ({
    id: String(o._id ?? o.id ?? o.slug ?? ""),
    name: String(o.name ?? ""),
    type: String(o.type ?? ""),
    description: String(o.description ?? ""),
    branchCount: Number((o.branches as unknown[])?.length ?? 0),
  }));
}

export async function submitJoinRequest(
  orgId: string,
  data: { specialties?: string[]; bio?: string; licenseNumber?: string; message?: string },
): Promise<JoinRequest> {
  const res = await api.post<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}/join-requests`,
    data,
  );
  return adaptJoinRequest(res.data.data as Record<string, unknown>);
}

export async function getMyJoinRequests(): Promise<JoinRequest[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>("/auth/me/join-requests");
  return res.data.data.map(adaptJoinRequest);
}

export async function getMyInvitations(): Promise<PendingInvitation[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>("/memberships/invites/pending/me");
  return res.data.data.map(adaptInvitation);
}

export async function acceptInvitation(
  token: string,
): Promise<{ accessToken: string; membershipId: string }> {
  const res = await api.post<{ accessToken: string; membershipId: string }>(
    "/memberships/invites/accept/existing",
    { token },
  );
  return res.data;
}

// ── Admin-facing ───────────────────────────────────────────────────────────────

export async function getOrgJoinRequests(
  orgId: string,
  status = "pending",
): Promise<AdminJoinRequest[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/orgs/${orgId}/join-requests`,
    { params: { status } },
  );
  return res.data.data.map(adaptAdminRequest);
}

export async function resolveJoinRequest(
  orgId: string,
  requestId: string,
  action: "approve" | "reject",
): Promise<void> {
  await api.patch(`/orgs/${orgId}/join-requests/${requestId}`, { action });
}
