import { api } from "./api";
import type { Doctor, Session } from "../types/index";

// ── Adapted types for marketplace ─────────────────────────────────────────────

export type MarketplaceOrg = {
  id: string;
  name: string;
  type: string;
  description: string;
  logoUrl: string;
  slug: string;
  branches: MarketplaceBranch[];
};

export type MarketplaceBranch = {
  id: string;
  name: string;
  city: string;
  phone: string;
};

export type MarketplaceDoctor = {
  id: string;           // membership id
  orgId: string;
  name: string;
  specialty: string;
  bio: string;
  ratingAvg: number;
  ratingCount: number;
  consultationFee: number;
  languages: string[];
  insurance: string[];
  experienceYears: number;
};

export type MarketplaceReview = {
  id: string;
  rating: number;
  comment: string;
  patientName: string;
  date: string;
};

// ── Adapters ──────────────────────────────────────────────────────────────────

function adaptOrg(o: Record<string, unknown>): MarketplaceOrg {
  return {
    id: String(o._id ?? o.id),
    name: String(o.name ?? ""),
    type: String(o.type ?? "clinic"),
    description: String(o.description ?? ""),
    logoUrl: String(o.logoUrl ?? ""),
    slug: String(o.slug ?? ""),
    branches: [],
  };
}

function adaptBranch(b: Record<string, unknown>): MarketplaceBranch {
  const addr = (b.address as Record<string, unknown>) ?? {};
  return {
    id: String(b._id ?? b.id),
    name: String(b.name ?? ""),
    city: String(addr.city ?? ""),
    phone: String(b.phone ?? ""),
  };
}

function adaptDoctor(m: Record<string, unknown>): MarketplaceDoctor {
  const account = (m.account as Record<string, unknown>) ?? {};
  const stats = (m.ratingStats as Record<string, unknown>) ?? {};
  return {
    id: String(m._id ?? m.id),
    orgId: String(m.organization ?? ""),
    name: String(account.fullName ?? ""),
    specialty: (m.specialties as string[])?.[0] ?? "",
    bio: String(m.bio ?? ""),
    ratingAvg: Number(stats.avg ?? 0),
    ratingCount: Number(stats.count ?? 0),
    consultationFee: Number(m.consultationFee ?? 0),
    languages: (m.languagesSpoken as string[]) ?? [],
    insurance: (m.acceptedInsurances as string[]) ?? [],
    experienceYears: Number(m.yearsOfExperience ?? 0),
  };
}

function adaptBranchForClinic(b: Record<string, unknown>): MarketplaceBranch {
  const addr = (b.address as Record<string, unknown>) ?? {};
  return {
    id: String(b._id ?? b.id),
    name: String(b.name ?? ""),
    city: String(addr.city ?? ""),
    phone: String(b.phone ?? ""),
  };
}

// Adapt a backend session to the frontend Session type (best-effort mapping).
function adaptSession(
  s: Record<string, unknown>,
  orgId: string,
): Session {
  const start = new Date(String(s.startTime ?? ""));
  const end = new Date(String(s.endTime ?? ""));
  // Use ISO (UTC) string to match the UTC times stored by session generation
  const dateStr = isNaN(start.getTime()) ? "" : start.toISOString().slice(0, 10);
  const startT = isNaN(start.getTime()) ? "" : start.toISOString().slice(11, 16);
  const endT = isNaN(end.getTime()) ? "" : end.toISOString().slice(11, 16);

  const backendStatus = String(s.status ?? "scheduled");
  const status: Session["status"] =
    backendStatus === "active"
      ? "active"
      : backendStatus === "ended" || backendStatus === "cancelled"
        ? "closed"
        : "scheduled";

  const scheduleRef = (s.doctorBranchSchedule as Record<string, unknown>) ?? {};
  const scheduleFee = (scheduleRef.consultationFee as Record<string, unknown>)?.amount;

  return {
    id: String(s._id ?? s.id),
    doctorId: String(s.doctor ?? ""),
    clinicId: String(s.branch ?? ""),
    clinicName: String(s.branchName ?? ""),
    date: dateStr,
    startTime: startT,
    endTime: endT,
    availableSlots:
      Math.max(0, Number(s.maxBookings ?? 20) - Number(s.bookingsCount ?? 0)),
    status,
    avgConsultationMin: Number(s.avgConsultationMin ?? 15),
    fee: Number(scheduleFee ?? s.fee ?? 0),
    queueToken: String(s._id ?? s.id),
    orgId,
  } as Session;
}

// Adapt marketplace doctor membership to the frontend Doctor type.
export function membershipToDoctor(
  m: MarketplaceDoctor,
  org: MarketplaceOrg,
): Doctor {
  const initials = m.name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return {
    id: m.id,
    name: m.name,
    initials,
    title: "Dr.",
    specialty: m.specialty,
    organization: org.name,
    area: org.branches[0]?.city ?? "",
    fee: m.consultationFee ?? 0,
    rating: m.ratingAvg,
    reviewCount: m.ratingCount,
    languages: m.languages,
    insurance: m.insurance,
    bio: m.bio,
    experienceYears: m.experienceYears,
    verified: true,
    availableLabel: "Available",
    clinics: org.branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.city,
      phone: b.phone,
    })),
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function searchOrgs(filters?: {
  query?: string;
  type?: string;
  city?: string;
  page?: number;
  limit?: number;
}): Promise<MarketplaceOrg[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    "/marketplace/orgs",
    { params: filters },
  );
  return (Array.isArray(res.data.data) ? res.data.data : []).map((o) =>
    adaptOrg(o as Record<string, unknown>),
  );
}

export async function getMarketplaceOrg(orgId: string): Promise<MarketplaceOrg> {
  const res = await api.get<{ data: Record<string, unknown> }>(
    `/marketplace/orgs/${orgId}`,
  );
  const o = res.data.data as Record<string, unknown>;
  const org = adaptOrg(o);
  const branches = (o.branches as Record<string, unknown>[]) ?? [];
  org.branches = branches.map((b) => adaptBranchForClinic(b));
  return org;
}

export async function getDoctorReviews(
  orgId: string,
  doctorId: string,
): Promise<MarketplaceReview[]> {
  try {
    const res = await api.get<{ data: Record<string, unknown>[] }>(
      `/marketplace/orgs/${orgId}/doctors/${doctorId}/reviews`,
    );
    const list = Array.isArray(res.data.data) ? res.data.data : [];
    return list.map((r) => {
      const raw = r as Record<string, unknown>;
      const appt = (raw.appointment as Record<string, unknown>) ?? {};
      const profile = (appt.patientProfile as Record<string, unknown>) ?? {};
      return {
        id: String(raw._id ?? raw.id),
        rating: Number(raw.rating ?? 0),
        comment: String(raw.comment ?? ""),
        patientName: String(profile.fullName ?? "Anonymous"),
        date: String(raw.createdAt ?? "").slice(0, 10),
      };
    });
  } catch {
    return [];
  }
}

export async function getOrgDoctors(orgId: string): Promise<MarketplaceDoctor[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/marketplace/orgs/${orgId}/doctors`,
  );
  return (Array.isArray(res.data.data) ? res.data.data : []).map((m) =>
    adaptDoctor(m as Record<string, unknown>),
  );
}

export async function getOrgSessions(
  orgId: string,
  doctorId?: string,
  date?: string,
): Promise<Session[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/marketplace/orgs/${orgId}/sessions`,
    { params: { doctorId, date } },
  );
  return (Array.isArray(res.data.data) ? res.data.data : []).map((s) =>
    adaptSession(s as Record<string, unknown>, orgId),
  );
}
