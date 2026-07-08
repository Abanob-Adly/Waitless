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
    avatarUrl: (m.avatarUrl as string | undefined) ?? "",
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
    defaultMaxBookings: s.defaultMaxBookings != null ? Number(s.defaultMaxBookings) : null,
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
  else if (nameLower.includes("business+") || nameLower.includes("business plus")) tier = "business+";
  else if (nameLower.includes("enterprise")) tier = "enterprise";
  else if (nameLower.includes("standard") || nameLower.includes("growth") || nameLower.includes("premium")) tier = "growth";
  else tier = "starter";

  const maxDoctors = Number(limits.maxDoctors ?? 1);
  const maxAdmins = Number(limits.maxAdmins ?? 1);
  const maxReceptionists = Number(limits.maxReceptionists ?? 0);
  const maxBranches = Number(limits.maxBranches ?? 1);
  const maxWhatsappNumbers = Number(limits.maxWhatsappNumbers ?? 0);

  const features: string[] = [];
  features.push(`Up to ${maxBranches} branch${maxBranches !== 1 ? "es" : ""}`);
  features.push(`Up to ${maxDoctors} doctor${maxDoctors !== 1 ? "s" : ""}`);
  features.push(`Up to ${maxAdmins} admin${maxAdmins !== 1 ? "s" : ""}`);
  if (maxReceptionists > 0) features.push(`Up to ${maxReceptionists} receptionist${maxReceptionists !== 1 ? "s" : ""}`);
  else features.push("No receptionists");
  if (Boolean(limits.marketplaceListing)) features.push("Marketplace listing");
  if (Boolean(limits.whatsappNotifications) && maxWhatsappNumbers > 0)
    features.push(`WhatsApp notifications (up to ${maxWhatsappNumbers} numbers)`);
  else if (Boolean(limits.whatsappNotifications))
    features.push("WhatsApp notifications");

  return {
    id: String(p._id ?? p.id),
    tier,
    name: String(p.name ?? ""),
    pricePerMonth: price,
    maxDoctors,
    maxAdmins,
    maxReceptionists,
    maxBranches,
    maxWhatsappNumbers,
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

// ── Plan purchase types ───────────────────────────────────────────────────────

export type PurchasePlanResult =
  | { method: "free";   subscription: Subscription }
  | { method: "wallet"; subscription: Subscription; invoice: Invoice; walletBalance: number };

export type Invoice = {
  id: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  currency: string;
  paymentMethod: "wallet" | "card" | "manual";
  paymobTransactionId: string | null;
  status: "paid" | "failed" | "refunded";
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

function adaptInvoice(inv: Record<string, unknown>): Invoice {
  return {
    id:                  String(inv._id ?? inv.id),
    invoiceNumber:       String(inv.invoiceNumber ?? ""),
    planName:            String(inv.planName ?? ""),
    amount:              Number(inv.amount ?? 0),
    currency:            String(inv.currency ?? "EGP"),
    paymentMethod:       (inv.paymentMethod as Invoice["paymentMethod"]) ?? "manual",
    paymobTransactionId: (inv.paymobTransactionId as string | null) ?? null,
    status:              (inv.status as Invoice["status"]) ?? "paid",
    periodStart:         String(inv.periodStart ?? ""),
    periodEnd:           String(inv.periodEnd ?? ""),
    createdAt:           String(inv.createdAt ?? ""),
  };
}

export async function purchasePlan(orgId: string, planId: string): Promise<PurchasePlanResult> {
  const res = await api.post<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}/subscription/purchase`,
    { planId },
  );
  const d = res.data.data;
  const method = d.method as string;

  if (method === "free") {
    return { method: "free", subscription: adaptSubscription(d.subscription as Record<string, unknown>) };
  }
  return {
    method:       "wallet",
    subscription: adaptSubscription(d.subscription as Record<string, unknown>),
    invoice:      adaptInvoice(d.invoice as Record<string, unknown>),
    walletBalance: Number(d.walletBalance ?? 0),
  };
}

export async function getInvoices(
  orgId: string,
  page = 1,
): Promise<{ invoices: Invoice[]; total: number }> {
  const res = await api.get<{ data: { invoices: Record<string, unknown>[]; total: number } }>(
    `/orgs/${orgId}/invoices`,
    { params: { page, limit: 20 } },
  );
  const { invoices, total } = res.data.data;
  return { invoices: invoices.map((i) => adaptInvoice(i)), total };
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
    kind?: "admin" | "doctor" | "receptionist";
    bio?: string;
    specialties?: string[];
    avatarUrl?: string | null;
    permissions?: string[];
    websiteUrl?: string | null;
    acceptedInsurances?: string[];
    yearsOfExperience?: number | null;
    languagesSpoken?: string[];
  },
): Promise<void> {
  await api.put(`/orgs/${orgId}/members/${memberId}`, data);
}

export async function grantMemberAdmin(orgId: string, memberId: string): Promise<boolean> {
  try {
    await api.post(`/orgs/${orgId}/members/${memberId}/grant-admin`);
    return true;
  } catch {
    return false;
  }
}

export async function revokeMemberAdmin(orgId: string, memberId: string): Promise<boolean> {
  try {
    await api.delete(`/orgs/${orgId}/members/${memberId}/grant-admin`);
    return true;
  } catch {
    return false;
  }
}

export async function selfJoinAsDoctor(
  orgId: string,
  data?: { specialties?: string[]; licenseNumber?: string; bio?: string },
): Promise<void> {
  await api.post(`/orgs/${orgId}/members/self/doctor`, data ?? {});
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
    defaultMaxBookings?: number | null;
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
      defaultMaxBookings: data.defaultMaxBookings ?? null,
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
    defaultMaxBookings?: number | null;
  },
): Promise<{ schedule: DoctorBranchSchedule; sessionsGenerated: number }> {
  const payload: Record<string, unknown> = {};
  if (data.schedule !== undefined) payload.schedule = data.schedule;
  if (data.avgConsultationMin !== undefined) payload.avgConsultationMin = data.avgConsultationMin;
  if (data.consultationFee !== undefined) payload.consultationFee = { amount: data.consultationFee, currency: 'EGP' };
  if (data.defaultMaxBookings !== undefined) payload.defaultMaxBookings = data.defaultMaxBookings;
  const res = await api.put<{ data: Record<string, unknown>; sessionsGenerated?: number }>(
    `/orgs/${orgId}/schedules/${scheduleId}`,
    payload,
  );
  const raw = res.data as { data: Record<string, unknown>; sessionsGenerated?: number };
  return {
    schedule: adaptSchedule(raw.data),
    sessionsGenerated: Number(raw.sessionsGenerated ?? 0),
  };
}

export async function addException(
  orgId: string,
  scheduleId: string,
  data: { date: string; reason: string; note?: string },
): Promise<void> {
  await api.post(`/orgs/${orgId}/schedules/${scheduleId}/exceptions`, data);
}

export { saveTokens };

// ── Wallet ────────────────────────────────────────────────────────────────────

export type WalletTransaction = {
  id: string;
  patientName: string;
  branchName: string;
  branchId: string;
  grossAmount: number;
  platformCut: number;
  orgNet: number;
  currency: string;
  status: "settled" | "pending" | "refunded";
  createdAt: string;
};

export type WalletSummary = {
  totalEarnings: number;
  pendingAmount: number;
  thisMonthEarnings: number;
  currency: string;
};

export async function getWalletSummary(orgId: string): Promise<WalletSummary> {
  const res = await api.get<{ data: WalletSummary }>(`/orgs/${orgId}/transactions/summary`);
  return res.data.data;
}

export async function getTransactions(
  orgId: string,
  filters?: { branchId?: string; status?: string; from?: string; to?: string; page?: number; limit?: number },
): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const res = await api.get<{ data: { transactions: Record<string, unknown>[]; total: number } }>(
    `/orgs/${orgId}/transactions`,
    { params: filters },
  );
  const { transactions, total } = res.data.data;
  return {
    total,
    transactions: transactions.map((tx) => ({
      id: String(tx._id ?? tx.id),
      patientName: String(tx.patientName ?? ""),
      branchName: String((tx.branch as Record<string, unknown>)?.name ?? ""),
      branchId: String((tx.branch as Record<string, unknown>)?._id ?? tx.branch ?? ""),
      grossAmount: Number(tx.grossAmount ?? 0),
      platformCut: Number(tx.platformCut ?? 0),
      orgNet: Number(tx.orgNet ?? 0),
      currency: String(tx.currency ?? "EGP"),
      status: (tx.status as WalletTransaction["status"]) ?? "settled",
      createdAt: String(tx.createdAt ?? ""),
    })),
  };
}
