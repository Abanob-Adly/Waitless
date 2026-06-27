import { api } from "./api";
import { saveTokens } from "./authService";
import type {
  Organization,
  Branch,
  Membership,
  DoctorBranchSchedule,
  Subscription,
  SubscriptionPlan,
} from "../types/index";

// ── Helper: unwrap { data: ... } responses ────────────────────────────────────
function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

// ── Adapters (backend → frontend types) ──────────────────────────────────────

function adaptOrg(o: Record<string, unknown>): Organization {
  return {
    id: String(o._id ?? o.id),
    name: String(o.name ?? ""),
    type: (o.type as Organization["type"]) ?? "clinic",
    country: String(o.country ?? ""),
    timezone: String(o.timezone ?? ""),
    isPublic: Boolean(o.isPublic),
    createdAt: String(o.createdAt ?? ""),
    trialEndsAt: String(o.trialEndsAt ?? ""),
    whatsappNumber: (o.whatsappNumber as string | null | undefined) ?? null,
  };
}

function adaptBranch(b: Record<string, unknown>): Branch {
  return {
    id: String(b._id ?? b.id),
    orgId: String(b.organization ?? ""),
    name: String(b.name ?? ""),
    address: String(
      (b.address as Record<string, unknown>)?.street ??
        (b.address as string) ??
        "",
    ),
    city: String((b.address as Record<string, unknown>)?.city ?? ""),
    phone: String(b.phone ?? ""),
  };
}

function adaptMembership(m: Record<string, unknown>): Membership {
  const account = (m.account as Record<string, unknown>) ?? {};
  return {
    id: String(m._id ?? m.id),
    orgId: String(m.organization ?? ""),
    userId: String(account._id ?? account.id ?? ""),
    userRole: (m.kind as Membership["userRole"]) ?? "doctor",
    status: m.status === "active" ? "active" : "pending",
    branchId: Array.isArray(m.branches) ? String(m.branches[0] ?? "") : "",
    inviteToken: String(m.inviteToken ?? ""),
    invitedEmail: String(account.email ?? m.inviteEmail ?? ""),
    memberName: String(account.fullName ?? ""),
    createdAt: String(m.createdAt ?? ""),
    bio: m.bio as string | undefined,
    specialties: m.specialties as string[] | undefined,
    websiteUrl: (m.websiteUrl as string | null | undefined) ?? null,
    acceptedInsurances: (m.acceptedInsurances as string[] | undefined) ?? [],
    yearsOfExperience: (m.yearsOfExperience as number | null | undefined) ?? null,
    languagesSpoken: (m.languagesSpoken as string[] | undefined) ?? [],
  };
}

function adaptSchedule(s: Record<string, unknown>): DoctorBranchSchedule {
  const rawSlots = (s.schedule as Array<Record<string, unknown>>) ?? [];
  const doctorMembership = (s.doctorMembership as Record<string, unknown>) ?? {};
  const doctorAccount = (doctorMembership.account as Record<string, unknown>) ?? {};
  const specialties = (doctorMembership.specialties as string[]) ?? [];
  const branch = (s.branch as Record<string, unknown>) ?? {};
  return {
    id: String(s._id ?? s.id),
    doctorId: String(doctorMembership._id ?? s.doctorMembership ?? ""),
    branchId: String(branch._id ?? s.branch ?? ""),
    doctorName: String(doctorAccount.fullName ?? ""),
    specialty: specialties[0] ?? "",
    weeklySlots: rawSlots.map((slot) => ({
      dayOfWeek: Number(slot.dayOfWeek ?? 0),
      startTime: String(slot.startTime ?? ""),
      endTime: String(slot.endTime ?? ""),
    })),
    fee: Number((s.consultationFee as { amount?: number } | null)?.amount ?? s.consultationFee ?? 0),
    avgConsultationMin: Number(s.avgConsultationMin ?? 15),
    isActive: s.status !== "inactive",
  };
}

function adaptSubscription(sub: Record<string, unknown>): Subscription {
  const plan = (sub.plan as Record<string, unknown>) ?? {};
  // Backend uses `state`, not `status`
  const state = (sub.state ?? sub.status) as string;
  return {
    id: String(sub._id ?? sub.id),
    orgId: String(sub.organization ?? ""),
    planId: String(plan._id ?? plan.id ?? sub.plan ?? ""),
    status:
      state === "active" ? "active" : state === "cancelled" ? "cancelled" : "trial",
    currentPeriodEnd: String(sub.currentPeriodEnd ?? ""),
  };
}

function adaptPlan(p: Record<string, unknown>): SubscriptionPlan {
  const price = Number((p.priceMonthly ?? p.pricePerMonth) ?? 0);
  const nameLower = String(p.name ?? "").toLowerCase();
  const limits = (p.limits as Record<string, unknown>) ?? {};

  let tier: SubscriptionPlan["tier"] = "trial";
  if (price === 0) tier = "trial";
  else if (nameLower.includes("enterprise")) tier = "enterprise";
  else if (nameLower.includes("standard") || nameLower.includes("growth") || nameLower.includes("premium")) tier = "growth";
  else tier = "starter";

  const features: string[] = [];
  if (Number(limits.maxBranches) > 0) features.push(`Up to ${limits.maxBranches} branch${Number(limits.maxBranches) !== 1 ? "es" : ""}`);
  if (Number(limits.maxDoctors) > 0) features.push(`Up to ${limits.maxDoctors} doctors`);
  if (Number(limits.maxReceptionists) > 0) features.push(`Up to ${limits.maxReceptionists} receptionists`);
  if (Boolean(limits.marketplaceListing)) features.push("Marketplace listing");
  if (Boolean(limits.whatsappNotifications)) features.push("WhatsApp notifications");

  return {
    id: String(p._id ?? p.id),
    tier,
    name: String(p.name ?? ""),
    pricePerMonth: price,
    maxDoctors: Number(limits.maxDoctors ?? 5),
    maxBranches: Number(limits.maxBranches ?? 1),
    features,
    marketplaceListing: Boolean(limits.marketplaceListing),
    whatsappNotifications: Boolean(limits.whatsappNotifications),
  };
}

// ── Org ───────────────────────────────────────────────────────────────────────

export async function createOrg(data: {
  name: string;
  slug: string;
  type: "clinic" | "hospital" | "polyclinic";
  description?: string;
  isPublic?: boolean;
}): Promise<{ org: Organization; accessToken: string }> {
  const res = await api.post<{
    data: { org: Record<string, unknown>; accessToken: string };
  }>("/orgs", data);
  const { org, accessToken } = res.data.data;
  return { org: adaptOrg(org), accessToken };
}

export async function getOrg(orgId: string): Promise<Organization> {
  const res = await api.get<{ data: { org: Record<string, unknown> } }>(
    `/orgs/${orgId}`,
  );
  return adaptOrg(res.data.data.org ?? (res.data.data as unknown as Record<string, unknown>));
}

export async function updateOrg(
  orgId: string,
  data: Partial<{
    name: string;
    type: string;
    description: string;
    isPublic: boolean;
    whatsappNumber: string | null;
  }>,
): Promise<Organization> {
  const res = await api.put<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}`,
    data,
  );
  return adaptOrg(unwrap(res) as Record<string, unknown>);
}

export async function getSubscription(orgId: string): Promise<Subscription> {
  const res = await api.get<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}/subscription`,
  );
  return adaptSubscription(unwrap(res) as Record<string, unknown>);
}

export async function getPlans(): Promise<SubscriptionPlan[]> {
  try {
    const res = await api.get<{ data: Record<string, unknown>[] }>("/orgs/plans");
    const list = Array.isArray(res.data.data) ? res.data.data : [];
    return list.map((p) => adaptPlan(p as Record<string, unknown>));
  } catch (err) {
    console.error("[getPlans]", err);
    return [];
  }
}

export async function upgradePlan(orgId: string, planId: string): Promise<Subscription | null> {
  try {
    const res = await api.post<{ data: Record<string, unknown> }>(
      `/orgs/${orgId}/subscription/upgrade`,
      { planId },
    );
    return adaptSubscription(res.data.data);
  } catch {
    return null;
  }
}

export async function toggleVisibility(orgId: string, isPublic: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.patch(`/orgs/${orgId}/visibility`, { isPublic });
    return { ok: true };
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? "Failed to update visibility";
    return { ok: false, error: msg };
  }
}

// ── Branches ─────────────────────────────────────────────────────────────────

export async function getBranches(orgId: string): Promise<Branch[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/orgs/${orgId}/branches`,
  );
  const list = unwrap(res);
  return (Array.isArray(list) ? list : []).map((b) => adaptBranch(b as Record<string, unknown>));
}

export async function createBranch(
  orgId: string,
  data: {
    name: string;
    address?: { street?: string; city?: string };
    phone?: string;
  },
): Promise<Branch> {
  const res = await api.post<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}/branches`,
    data,
  );
  return adaptBranch(unwrap(res) as Record<string, unknown>);
}

export async function updateBranch(
  orgId: string,
  branchId: string,
  data: Partial<{ name: string; phone: string; isActive: boolean }>,
): Promise<Branch> {
  const res = await api.put<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}/branches/${branchId}`,
    data,
  );
  return adaptBranch(unwrap(res) as Record<string, unknown>);
}

export async function deleteBranch(
  orgId: string,
  branchId: string,
): Promise<void> {
  await api.delete(`/orgs/${orgId}/branches/${branchId}`);
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function getMembers(orgId: string): Promise<Membership[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/orgs/${orgId}/members`,
  );
  const list = unwrap(res);
  return (Array.isArray(list) ? list : []).map((m) => adaptMembership(m as Record<string, unknown>));
}

export async function inviteMember(
  orgId: string,
  data: {
    email: string;
    kind: "admin" | "doctor" | "receptionist";
    specialties?: string[];
    licenseNumber?: string;
    bio?: string;
    branches?: string[];
    permissions?: string[];
  },
): Promise<{ token: string }> {
  const res = await api.post<{ data: { inviteToken?: string; token?: string } }>(
    `/orgs/${orgId}/members/invite`,
    data,
  );
  const d = unwrap(res) as Record<string, unknown>;
  // Backend returns inviteToken (from memberService) or token field
  return { token: String(d.inviteToken ?? d.token ?? "") };
}

export async function revokeMember(
  orgId: string,
  memberId: string,
): Promise<void> {
  await api.delete(`/orgs/${orgId}/members/${memberId}`);
}

export async function updateMember(
  orgId: string,
  memberId: string,
  data: {
    bio?: string;
    specialties?: string[];
    avatarUrl?: string;
    permissions?: string[];
    websiteUrl?: string | null;
    acceptedInsurances?: string[];
    yearsOfExperience?: number | null;
    languagesSpoken?: string[];
  },
): Promise<boolean> {
  try {
    await api.put(`/orgs/${orgId}/members/${memberId}`, data);
    return true;
  } catch {
    return false;
  }
}

// ── Schedules ─────────────────────────────────────────────────────────────────

export async function getSchedules(orgId: string): Promise<DoctorBranchSchedule[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/orgs/${orgId}/schedules`,
  );
  const list = unwrap(res);
  return (Array.isArray(list) ? list : []).map((s) =>
    adaptSchedule(s as Record<string, unknown>),
  );
}

export async function createSchedule(
  orgId: string,
  data: {
    doctorMembershipId: string;
    branchId: string;
    schedule: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;
    avgConsultationMin?: number;
    consultationFee?: number;
  },
): Promise<{ schedule: DoctorBranchSchedule; sessionsGenerated: number }> {
  const res = await api.post<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}/schedules`,
    {
      doctorMembershipId: data.doctorMembershipId,
      branchId: data.branchId,
      schedule: data.schedule,
      avgConsultationMin: data.avgConsultationMin ?? 15,
      consultationFee: data.consultationFee != null
        ? { amount: data.consultationFee, currency: 'EGP' }
        : undefined,
    },
  );
  const raw = unwrap(res) as Record<string, unknown>;
  // Backend now returns { schedule, sessionsGenerated }
  const scheduleRaw = (raw.schedule as Record<string, unknown>) ?? raw;
  const sessionsGenerated = Number(raw.sessionsGenerated ?? 0);
  return { schedule: adaptSchedule(scheduleRaw), sessionsGenerated };
}

export async function updateSchedule(
  orgId: string,
  scheduleId: string,
  data: {
    schedule?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
    avgConsultationMin?: number;
    consultationFee?: number;
  },
): Promise<DoctorBranchSchedule> {
  const payload: Record<string, unknown> = {};
  if (data.schedule !== undefined) payload.schedule = data.schedule;
  if (data.avgConsultationMin !== undefined) payload.avgConsultationMin = data.avgConsultationMin;
  if (data.consultationFee !== undefined) payload.consultationFee = { amount: data.consultationFee, currency: 'EGP' };
  const res = await api.put<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}/schedules/${scheduleId}`,
    payload,
  );
  return adaptSchedule(unwrap(res) as Record<string, unknown>);
}

export async function addException(
  orgId: string,
  scheduleId: string,
  data: { date: string; reason: string; note?: string },
): Promise<void> {
  await api.post(`/orgs/${orgId}/schedules/${scheduleId}/exceptions`, data);
}

export { saveTokens };
