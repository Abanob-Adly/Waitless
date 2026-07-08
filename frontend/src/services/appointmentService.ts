import { api } from "./api";
import { toE164 } from "../utils/phone";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppointmentType = "new_consultation" | "follow_up" | "medical_rep";

export type BookedAppointment = {
  id: string;
  queueNumber: number;
  status: string;
  accessToken: string;
  sessionId: string;
  patientName: string;
  patientPhone: string;
  source: "walk_in" | "marketplace";
  estimatedWaitMin?: number;
};

export type TrackResult = {
  queueNumber: number;
  currentlyServing: number;
  estimatedWaitMin: number;
  status: string;
};

// ── Helper ────────────────────────────────────────────────────────────────────

function sessionBase(orgId: string, branchId: string, sessionId: string) {
  return `/orgs/${orgId}/branches/${branchId}/sessions/${sessionId}/appointments`;
}

function adaptBooked(
  a: Record<string, unknown>,
  accessToken: string,
  estimatedWaitMin?: number,
): BookedAppointment {
  const profile = (a.patientProfile as Record<string, unknown>) ?? {};
  return {
    id: String(a._id ?? a.id),
    queueNumber: Number(a.queueNumber ?? 0),
    status: String(a.status ?? "booked"),
    accessToken,
    sessionId: String(a.session ?? ""),
    patientName: String(profile.fullName ?? ""),
    patientPhone: String(profile.phone ?? ""),
    source: (a.source as BookedAppointment["source"]) ?? "walk_in",
    estimatedWaitMin,
  };
}

// ── Walk-in booking (receptionist) ───────────────────────────────────────────

export async function bookWalkIn(
  orgId: string,
  branchId: string,
  sessionId: string,
  data: {
    patientPhone: string;
    patientName: string;
    notes?: string;
    appointmentType?: AppointmentType;
  },
): Promise<BookedAppointment> {
  const res = await api.post<{
    data: {
      appointment: Record<string, unknown>;
      accessToken: string;
      estimatedWaitMin?: number;
    };
  }>(sessionBase(orgId, branchId, sessionId), {
    patientPhone:    toE164(data.patientPhone),
    patientName:     data.patientName,
    notes:           data.notes,
    appointmentType: data.appointmentType,
  });
  const { appointment, accessToken, estimatedWaitMin } = res.data.data;
  return adaptBooked(appointment, accessToken, estimatedWaitMin);
}

// ── List appointments in a session ───────────────────────────────────────────

export async function listAppointments(
  orgId: string,
  branchId: string,
  sessionId: string,
): Promise<BookedAppointment[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    sessionBase(orgId, branchId, sessionId),
  );
  return (Array.isArray(res.data.data) ? res.data.data : []).map((a) =>
    adaptBooked(a as Record<string, unknown>, ""),
  );
}

// ── Cancel appointment ────────────────────────────────────────────────────────

export async function cancelAppointment(
  orgId: string,
  branchId: string,
  sessionId: string,
  appointmentId: string,
  reason?: string,
): Promise<void> {
  await api.delete(
    `${sessionBase(orgId, branchId, sessionId)}/${appointmentId}`,
    { data: { reason } },
  );
}

// ── Public track by token ─────────────────────────────────────────────────────

export async function trackByToken(token: string): Promise<TrackResult> {
  const res = await api.get<{ data: TrackResult }>(
    `/appointments/track/${token}`,
  );
  return res.data.data;
}

// ── Marketplace booking ───────────────────────────────────────────────────────

export async function bookMarketplace(
  sessionId: string,
  data?: { notes?: string; paymentMethod?: "card" | "vodafone_cash" | "clinic" | "wallet" },
): Promise<BookedAppointment> {
  const res = await api.post<{
    data: { appointment: Record<string, unknown>; accessToken: string };
  }>(`/marketplace/sessions/${sessionId}/book`, data ?? {});
  const { appointment, accessToken } = res.data.data;
  return adaptBooked(appointment, accessToken);
}
