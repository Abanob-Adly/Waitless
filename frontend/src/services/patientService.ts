import { api } from "./api";

export type PatientRecord = {
  id: string;
  accountId?: string;
  fullName: string;
  phone: string;
  gender?: "male" | "female";
  dateOfBirth?: string;
  avatarUrl?: string;
  organizationId?: string;
};

export type AppointmentHistoryItem = {
  id: string;
  queueNumber: number;
  status: string;
  sessionDate?: string;
  doctorName?: string;
  specialty?: string;
};

function adaptPatient(p: Record<string, unknown>): PatientRecord {
  return {
    id: String(p._id ?? p.id),
    accountId: p.accountId ? String(p.accountId) : undefined,
    fullName: String(p.fullName ?? ""),
    phone: String(p.phone ?? ""),
    gender: p.gender as PatientRecord["gender"],
    dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth) : undefined,
    avatarUrl: p.avatarUrl ? String(p.avatarUrl) : undefined,
    organizationId: p.organizationId ? String(p.organizationId) : undefined,
  };
}

export async function getOwnProfile(): Promise<PatientRecord | null> {
  try {
    const res = await api.get<{ data: Record<string, unknown> }>("/patients/me");
    return adaptPatient(res.data.data);
  } catch {
    return null;
  }
}

export async function updateOwnProfile(data: {
  fullName?: string;
  phone?: string;
  gender?: "male" | "female";
  dateOfBirth?: string;
  avatarUrl?: string | null;
}): Promise<PatientRecord | null> {
  try {
    const res = await api.patch<{ data: Record<string, unknown> }>("/patients/me", data);
    return adaptPatient(res.data.data);
  } catch {
    return null;
  }
}

export async function lookupPatientByPhone(
  orgId: string,
  phone: string,
): Promise<PatientRecord | null> {
  try {
    const res = await api.get<{ data: Record<string, unknown>[] }>(
      `/orgs/${orgId}/patients`,
      { params: { phone } },
    );
    const list = Array.isArray(res.data.data) ? res.data.data : [];
    return list.length > 0 ? adaptPatient(list[0] as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function getPatients(orgId: string): Promise<PatientRecord[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/orgs/${orgId}/patients`,
  );
  return (Array.isArray(res.data.data) ? res.data.data : []).map((p) =>
    adaptPatient(p as Record<string, unknown>),
  );
}

export async function getPatient(
  orgId: string,
  profileId: string,
): Promise<PatientRecord> {
  const res = await api.get<{ data: Record<string, unknown> }>(
    `/orgs/${orgId}/patients/${profileId}`,
  );
  return adaptPatient(res.data.data);
}

export type OwnAppointmentItem = {
  id: string;
  queueNumber: number;
  status: string;
  accessToken?: string;
  sessionDate?: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  fee?: number;
};

// Lightweight type for active tickets loaded from backend on any device.
// `accessToken` drives the live-tracking view at /ticket/:token.
export type ActiveTicketItem = {
  id: string;
  queueNumber: number;
  status: string;
  accessToken: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
};

const ACTIVE_STATUSES = new Set(["booked", "called", "held", "in_progress"]);

export async function getOwnActiveTickets(): Promise<ActiveTicketItem[]> {
  try {
    const res = await api.get<{ data: Record<string, unknown>[] }>("/appointments/mine");
    const list = Array.isArray(res.data.data) ? res.data.data : [];
    return list
      .filter((a) => ACTIVE_STATUSES.has(String((a as Record<string, unknown>).status ?? "")))
      .map((a) => {
        const raw = a as Record<string, unknown>;
        const session = (raw.session as Record<string, unknown>) ?? {};
        const doctor = (raw.doctorMembership as Record<string, unknown>) ?? {};
        const account = (doctor.account as Record<string, unknown>) ?? {};
        const specialties = (doctor.specialties as string[]) ?? [];
        const branch = (raw.branch as Record<string, unknown>) ?? {};
        const startIso = String(session.startTime ?? "");
        const endIso = String(session.endTime ?? "");
        return {
          id: String(raw._id ?? raw.id),
          queueNumber: Number(raw.queueNumber ?? 0),
          status: String(raw.status ?? "booked"),
          accessToken: raw.accessToken ? String(raw.accessToken) : "",
          doctorName: String(account.fullName ?? "Unknown Doctor"),
          specialty: specialties[0] ?? "",
          clinicName: String(branch.name ?? ""),
          sessionDate: startIso ? startIso.slice(0, 10) : "",
          sessionStartTime: startIso ? startIso.slice(11, 16) : "",
          sessionEndTime: endIso ? endIso.slice(11, 16) : "",
        };
      });
  } catch {
    return [];
  }
}

export async function getOwnAppointmentHistory(): Promise<OwnAppointmentItem[]> {
  try {
    const res = await api.get<{ data: Record<string, unknown>[] }>("/appointments/mine");
    const list = Array.isArray(res.data.data) ? res.data.data : [];
    return list.map((a) => {
      const raw = a as Record<string, unknown>;
      const session = (raw.session as Record<string, unknown>) ?? {};
      const doctor = (raw.doctorMembership as Record<string, unknown>) ?? {};
      const account = (doctor.account as Record<string, unknown>) ?? {};
      const specialties = (doctor.specialties as string[]) ?? [];
      const branch = (raw.branch as Record<string, unknown>) ?? {};
      const startTime = session.startTime ? String(session.startTime) : "";
      return {
        id: String(raw._id ?? raw.id),
        queueNumber: Number(raw.queueNumber ?? 0),
        status: String(raw.status ?? "booked"),
        accessToken: raw.accessToken ? String(raw.accessToken) : undefined,
        sessionDate: startTime ? startTime.slice(0, 10) : undefined,
        doctorName: String(account.fullName ?? "Unknown Doctor"),
        specialty: specialties[0] ?? "",
        clinicName: String(branch.name ?? ""),
      };
    });
  } catch {
    return [];
  }
}

export async function getPatientHistory(
  orgId: string,
  profileId: string,
): Promise<AppointmentHistoryItem[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/orgs/${orgId}/patients/${profileId}/history`,
  );
  return (Array.isArray(res.data.data) ? res.data.data : []).map((a) => ({
    id: String((a as Record<string, unknown>)._id ?? (a as Record<string, unknown>).id),
    queueNumber: Number((a as Record<string, unknown>).queueNumber ?? 0),
    status: String((a as Record<string, unknown>).status ?? ""),
    sessionDate: (a as Record<string, unknown>).sessionDate as string | undefined,
    doctorName: (a as Record<string, unknown>).doctorName as string | undefined,
    specialty: (a as Record<string, unknown>).specialty as string | undefined,
  }));
}
