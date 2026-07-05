import { api } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionExcuse = {
  submittedAt: string | null;
  reason: string | null;
  status: "pending" | "approved" | "denied" | null;
  reviewedAt: string | null;
};

export type BackendSession = {
  id: string;
  branchId: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "scheduled" | "active" | "ended" | "cancelled";
  bookingsCount: number;
  currentServing: number;
  avgConsultationMin: number;
  maxBookings: number | null;
  isOnBreak: boolean;
  globalDelayMin: number;
  excuse: SessionExcuse | null;
  penaltyApplied: { amount: number; appliedAt: string } | null;
  lateStartMin: number;
};

export type QueueStatus = {
  queueNumber: number;
  currentlyServing: number;
  estimatedWaitMin: number;
  status: string;
  appointments: BackendAppointment[];
};

export type BackendAppointment = {
  id: string;
  queueNumber: number;
  status: string;
  patientProfile: {
    id: string;
    fullName: string;
    phone: string;
  };
  calledAt?: string;
  completedAt?: string;
  skippedAt?: string;
  notes?: string;
};

// ── Helper ────────────────────────────────────────────────────────────────────

function base(orgId: string, branchId: string) {
  return `/orgs/${orgId}/branches/${branchId}/sessions`;
}

function adaptSession(s: Record<string, unknown>): BackendSession {
  // Backend may populate doctor membership with account data
  const doctorObj = s.doctor as Record<string, unknown> | null | undefined;
  const doctorAccount = (doctorObj?.account as Record<string, unknown>) ?? {};

  // Parse date from ISO startTime
  const startIso = String(s.startTime ?? "");
  const date = startIso ? startIso.slice(0, 10) : "";

  return {
    id: String(s._id ?? s.id),
    branchId: String(s.branch ?? ""),
    doctorId: typeof doctorObj === "object" && doctorObj !== null
      ? String(doctorObj._id ?? doctorObj.id ?? "")
      : String(s.doctor ?? ""),
    doctorName: String(doctorAccount.fullName ?? ""),
    specialty:
      Array.isArray(doctorObj?.specialties)
        ? String((doctorObj?.specialties as string[])[0] ?? "")
        : "",
    scheduleId: String(s.doctorBranchSchedule ?? ""),
    date,
    startTime: startIso ? startIso.slice(11, 16) : "",
    endTime: (() => {
      const endIso = String(s.endTime ?? "");
      return endIso ? endIso.slice(11, 16) : "";
    })(),
    status: (s.status as BackendSession["status"]) ?? "scheduled",
    bookingsCount: Number(s.bookingsCount ?? 0),
    currentServing: Number(s.currentServing ?? 0),
    avgConsultationMin: Number(s.avgConsultationMin ?? 15),
    maxBookings: s.maxBookings != null ? Number(s.maxBookings) : null,
    isOnBreak: Boolean(s.isOnBreak ?? false),
    globalDelayMin: Number(s.globalDelayMin ?? 0),
    lateStartMin: Number(s.lateStartMin ?? 0),
    excuse: s.excuse
      ? {
          submittedAt: (s.excuse as Record<string, unknown>).submittedAt as string | null,
          reason:      (s.excuse as Record<string, unknown>).reason as string | null,
          status:      (s.excuse as Record<string, unknown>).status as SessionExcuse["status"],
          reviewedAt:  (s.excuse as Record<string, unknown>).reviewedAt as string | null,
        }
      : null,
    penaltyApplied: s.penaltyApplied
      ? {
          amount:    Number((s.penaltyApplied as Record<string, unknown>).amount ?? 0),
          appliedAt: String((s.penaltyApplied as Record<string, unknown>).appliedAt ?? ""),
        }
      : null,
  };
}

// ── Session CRUD ──────────────────────────────────────────────────────────────

export async function getSessions(
  orgId: string,
  branchId: string,
  filters?: { date?: string; fromDate?: string; toDate?: string },
): Promise<BackendSession[]> {
  const params = new URLSearchParams();
  if (filters?.date) params.append("date", filters.date);
  if (filters?.fromDate) params.append("fromDate", filters.fromDate);
  if (filters?.toDate) params.append("toDate", filters.toDate);
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `${base(orgId, branchId)}?${params.toString()}`,
  );
  const list = res.data.data;
  return (Array.isArray(list) ? list : []).map((s) =>
    adaptSession(s as Record<string, unknown>),
  );
}

export async function getSession(
  orgId: string,
  branchId: string,
  sessionId: string,
): Promise<BackendSession> {
  const res = await api.get<{ data: Record<string, unknown> }>(
    `${base(orgId, branchId)}/${sessionId}`,
  );
  return adaptSession(res.data.data as Record<string, unknown>);
}

export async function generateSessions(
  orgId: string,
  branchId: string,
  data: { scheduleId: string; fromDate: string; toDate: string },
): Promise<{ created: number; skipped: number }> {
  const res = await api.post<{ data: { created: number; skipped: number } }>(
    `${base(orgId, branchId)}/generate`,
    data,
  );
  return res.data.data;
}

export async function startSession(
  orgId: string,
  branchId: string,
  sessionId: string,
): Promise<BackendSession> {
  const res = await api.post<{ data: Record<string, unknown> }>(
    `${base(orgId, branchId)}/${sessionId}/start`,
  );
  return adaptSession(res.data.data as Record<string, unknown>);
}

export async function endSession(
  orgId: string,
  branchId: string,
  sessionId: string,
): Promise<BackendSession> {
  const res = await api.post<{ data: Record<string, unknown> }>(
    `${base(orgId, branchId)}/${sessionId}/end`,
  );
  return adaptSession(res.data.data as Record<string, unknown>);
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export async function getQueue(
  orgId: string,
  branchId: string,
  sessionId: string,
): Promise<QueueStatus> {
  const res = await api.get<{ data: Record<string, unknown> }>(
    `${base(orgId, branchId)}/${sessionId}/queue`,
  );
  const d = res.data.data;
  return {
    queueNumber: Number(d.currentServing ?? 0),
    currentlyServing: Number(d.currentServing ?? 0),
    estimatedWaitMin: 0,
    status: String(d.status ?? ""),
    appointments: (Array.isArray(d.appointments) ? (d.appointments as Record<string, unknown>[]) : []).map(
      (a) => adaptAppointment(a),
    ),
  };
}

export async function callNext(
  orgId: string,
  branchId: string,
  sessionId: string,
): Promise<BackendAppointment | null> {
  const res = await api.post<{ data: Record<string, unknown> | null }>(
    `${base(orgId, branchId)}/${sessionId}/queue/call-next`,
  );
  const d = res.data.data;
  return d ? adaptAppointment(d as Record<string, unknown>) : null;
}

export async function updateAppointmentStatus(
  orgId: string,
  branchId: string,
  sessionId: string,
  appointmentId: string,
  status: string,
): Promise<BackendAppointment> {
  const res = await api.patch<{ data: Record<string, unknown> }>(
    `${base(orgId, branchId)}/${sessionId}/queue/appointments/${appointmentId}/status`,
    { status },
  );
  return adaptAppointment(res.data.data as Record<string, unknown>);
}

export async function holdPatient(
  orgId: string,
  branchId: string,
  sessionId: string,
  appointmentId: string,
): Promise<void> {
  await api.post(
    `${base(orgId, branchId)}/${sessionId}/queue/appointments/${appointmentId}/hold`,
  );
}

export async function reinsertPatient(
  orgId: string,
  branchId: string,
  sessionId: string,
  appointmentId: string,
): Promise<void> {
  await api.post(
    `${base(orgId, branchId)}/${sessionId}/queue/appointments/${appointmentId}/reinsert`,
  );
}


export async function updateSession(
  orgId: string,
  branchId: string,
  sessionId: string,
  data: { maxBookings?: number | null },
): Promise<BackendSession> {
  const res = await api.patch<{ data: Record<string, unknown> }>(
    `${base(orgId, branchId)}/${sessionId}`,
    data,
  );
  return adaptSession(res.data.data as Record<string, unknown>);
}

export async function updateSessionDelay(
  orgId: string,
  branchId: string,
  sessionId: string,
  globalDelayMin: number,
): Promise<void> {
  await api.patch(
    `${base(orgId, branchId)}/${sessionId}/queue/delay`,
    { globalDelayMin },
  );
}

// ── Break management ──────────────────────────────────────────────────────────

export async function startBreak(
  orgId: string,
  branchId: string,
  sessionId: string,
  durationMin: number,
  reason?: string,
): Promise<void> {
  await api.post(
    `${base(orgId, branchId)}/${sessionId}/break`,
    { durationMin, reason },
  );
}

export async function resumeFromBreak(
  orgId: string,
  branchId: string,
  sessionId: string,
): Promise<void> {
  await api.post(
    `${base(orgId, branchId)}/${sessionId}/resume`,
  );
}

export async function submitExcuse(
  orgId: string,
  branchId: string,
  sessionId: string,
  reason: string,
): Promise<{ excuse: SessionExcuse }> {
  const res = await api.post<{ data: { excuse: SessionExcuse } }>(
    `${base(orgId, branchId)}/${sessionId}/excuse`,
    { reason },
  );
  return res.data.data;
}

export async function reviewExcuse(
  orgId: string,
  branchId: string,
  sessionId: string,
  verdict: "approved" | "denied",
): Promise<{ excuse: SessionExcuse }> {
  const res = await api.patch<{ data: { excuse: SessionExcuse } }>(
    `${base(orgId, branchId)}/${sessionId}/excuse`,
    { verdict },
  );
  return res.data.data;
}

// ── Force Insert ──────────────────────────────────────────────────────────────

export async function forceInsertNext(
  orgId: string,
  branchId: string,
  sessionId: string,
  appointmentId: string,
): Promise<void> {
  await api.post(
    `${base(orgId, branchId)}/${sessionId}/queue/appointments/${appointmentId}/force-insert`,
  );
}

// ── Cash Summary ──────────────────────────────────────────────────────────────

export type CashSummaryEntry = {
  queueNumber: number;
  patientName: string;
  completedAt: string;
};

export type CashSummary = {
  totalCash: number;
  count: number;
  feePerAppointment: number;
  appointments: CashSummaryEntry[];
};

export async function getCashSummary(
  orgId: string,
  branchId: string,
  sessionId: string,
): Promise<CashSummary> {
  const res = await api.get<{ data: CashSummary }>(
    `${base(orgId, branchId)}/${sessionId}/cash-summary`,
  );
  return res.data.data;
}

function adaptAppointment(a: Record<string, unknown>): BackendAppointment {
  const profile = (a.patientProfile as Record<string, unknown>) ?? {};
  return {
    id: String(a._id ?? a.id),
    queueNumber: Number(a.queueNumber ?? 0),
    status: String(a.status ?? "booked"),
    patientProfile: {
      id: String(profile._id ?? profile.id ?? ""),
      fullName: String(profile.fullName ?? ""),
      phone: String(profile.phone ?? ""),
    },
    calledAt: a.calledAt as string | undefined,
    completedAt: a.completedAt as string | undefined,
    skippedAt: a.skippedAt as string | undefined,
    notes: a.notes as string | undefined,
  };
}
