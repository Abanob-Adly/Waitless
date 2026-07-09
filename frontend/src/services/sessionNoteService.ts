import { api } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionNoteEditEntry = {
  editedAt: string;
  editedBy: string;
};

export type SessionNote = {
  id: string;
  appointment: string;
  chiefComplaint: string;
  diagnosis: string;
  prescription: string;
  followUp: string;
  generalNotes: string;
  isSharedWithPatient: boolean;
  editHistory: SessionNoteEditEntry[];
  createdAt: string;
  updatedAt: string;
};

export type SessionNoteInput = {
  chiefComplaint?: string;
  diagnosis?: string;
  prescription?: string;
  followUp?: string;
  generalNotes?: string;
  isSharedWithPatient?: boolean;
};

// ── Helper ────────────────────────────────────────────────────────────────────

function adaptNote(n: Record<string, unknown>): SessionNote {
  return {
    id: String(n._id ?? n.id ?? ""),
    appointment: String(n.appointment ?? ""),
    chiefComplaint: String(n.chiefComplaint ?? ""),
    diagnosis: String(n.diagnosis ?? ""),
    prescription: String(n.prescription ?? ""),
    followUp: String(n.followUp ?? ""),
    generalNotes: String(n.generalNotes ?? ""),
    isSharedWithPatient: Boolean(n.isSharedWithPatient),
    editHistory: (Array.isArray(n.editHistory) ? n.editHistory : []).map((e) => {
      const entry = e as Record<string, unknown>;
      return { editedAt: String(entry.editedAt ?? ""), editedBy: String(entry.editedBy ?? "") };
    }),
    createdAt: String(n.createdAt ?? ""),
    updatedAt: String(n.updatedAt ?? ""),
  };
}

function base(orgId: string, branchId: string, sessionId: string) {
  return `/orgs/${orgId}/branches/${branchId}/sessions/${sessionId}/appointments`;
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function getNote(
  orgId: string,
  branchId: string,
  sessionId: string,
  appointmentId: string,
): Promise<SessionNote | null> {
  const res = await api.get<{ data: Record<string, unknown> | null }>(
    `${base(orgId, branchId, sessionId)}/${appointmentId}/notes`,
  );
  return res.data.data ? adaptNote(res.data.data) : null;
}

export async function upsertNote(
  orgId: string,
  branchId: string,
  sessionId: string,
  appointmentId: string,
  data: SessionNoteInput,
): Promise<SessionNote> {
  const res = await api.post<{ data: Record<string, unknown> }>(
    `${base(orgId, branchId, sessionId)}/${appointmentId}/notes`,
    data,
  );
  return adaptNote(res.data.data);
}

export async function getPatientNotes(orgId: string, profileId: string): Promise<SessionNote[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>(
    `/orgs/${orgId}/patients/${profileId}/notes`,
  );
  return (Array.isArray(res.data.data) ? res.data.data : []).map(adaptNote);
}

// ── Patient-facing: notes a doctor has explicitly shared ─────────────────────

export type SharedPatientNote = {
  id: string;
  chiefComplaint: string;
  diagnosis: string;
  prescription: string;
  followUp: string;
  generalNotes: string;
  doctorName: string;
  visitDate: string;
  createdAt: string;
};

function adaptSharedNote(n: Record<string, unknown>): SharedPatientNote {
  const appt = (n.appointment as Record<string, unknown>) ?? {};
  const session = (appt.session as Record<string, unknown>) ?? {};
  const doctor = (session.doctor as Record<string, unknown>) ?? {};
  const account = (doctor.account as Record<string, unknown>) ?? {};
  return {
    id: String(n._id ?? n.id ?? ""),
    chiefComplaint: String(n.chiefComplaint ?? ""),
    diagnosis: String(n.diagnosis ?? ""),
    prescription: String(n.prescription ?? ""),
    followUp: String(n.followUp ?? ""),
    generalNotes: String(n.generalNotes ?? ""),
    doctorName: String(account.fullName ?? ""),
    visitDate: String(session.startTime ?? n.createdAt ?? ""),
    createdAt: String(n.createdAt ?? ""),
  };
}

export async function getMySharedNotes(): Promise<SharedPatientNote[]> {
  const res = await api.get<{ data: Record<string, unknown>[] }>("/patients/me/notes");
  return (Array.isArray(res.data.data) ? res.data.data : []).map(adaptSharedNote);
}
