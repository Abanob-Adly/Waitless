import { MOCK_DOCTORS, MOCK_SESSIONS } from "../data/mockData";
import type { Doctor, Session, BookingPayload, PaymentPayload } from "../types/index";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Per-appointment serving counter — simulates Redis pub/sub state in production
const _servingMap = new Map<string, number>();

export async function fetchDoctors(
  filters?: { specialty?: string; area?: string },
): Promise<Doctor[]> {
  await delay(400);
  return MOCK_DOCTORS.filter((d) => {
    const okSpecialty = !filters?.specialty || d.specialty === filters.specialty;
    const okArea = !filters?.area || d.area === filters.area;
    return okSpecialty && okArea;
  });
}

export async function fetchDoctorProfile(id: string): Promise<Doctor | null> {
  await delay(300);
  return MOCK_DOCTORS.find((d) => d.id === id) ?? null;
}

export async function fetchSessions(doctorId: string): Promise<Session[]> {
  await delay(300);
  return MOCK_SESSIONS.filter((s) => s.doctorId === doctorId);
}

export async function submitBooking(
  payload: BookingPayload,
): Promise<{ appointmentId: string; queueNumber: number }> {
  await delay(1200);
  const appointmentId = `bk-${payload.doctorId}-${Date.now()}`;
  const queueNumber = Math.floor(Math.random() * 6) + 2;
  // Seed the serving map so the queue hook starts 3 behind
  _servingMap.set(appointmentId, Math.max(0, queueNumber - 3));
  return { appointmentId, queueNumber };
}

export async function processPayment(
  _payload: PaymentPayload,
): Promise<{ success: boolean }> {
  await delay(1800);
  return { success: true };
}

export async function cancelAppointment(_id: string): Promise<void> {
  await delay(600);
  _servingMap.delete(_id);
}

export async function fetchQueueStatus(
  appointmentId: string,
  queueNumber: number,
): Promise<{ currentServing: number }> {
  await delay(200);
  const prev = _servingMap.get(appointmentId) ?? Math.max(0, queueNumber - 3);
  // 65% chance of advancing by 1 per poll — simulates variable consultation time
  const next = Math.min(queueNumber, prev + (Math.random() > 0.35 ? 1 : 0));
  _servingMap.set(appointmentId, next);
  return { currentServing: next };
}
