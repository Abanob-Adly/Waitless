import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  Patient,
  ActiveBooking,
  HistoryRecord,
  BookingIntent,
} from "../types/index";

// Re-export all types so existing consumers don't need to change their imports
export type { Patient, ClinicLocation, Doctor, Session, ActiveBooking, HistoryRecord, BookingIntent } from "../types/index";

// ── Seed history ──────────────────────────────────────────────────────────────

const SEED_HISTORY: HistoryRecord[] = [
  {
    id: "h-001",
    doctorName: "Dr. Omar Farouk",
    doctorInitials: "OF",
    specialty: "Dermatology",
    date: "Fri, Jun 20, 2026",
    fee: 250,
    status: "completed",
  },
  {
    id: "h-002",
    doctorName: "Dr. Sara Mostafa",
    doctorInitials: "SM",
    specialty: "Pediatrics",
    date: "Mon, Jun 16, 2026",
    fee: 200,
    status: "cancelled",
  },
];

// ── Context ───────────────────────────────────────────────────────────────────

type AppCtx = {
  patient: Patient | null;
  setPatient: (p: Patient | null) => void;
  booking: ActiveBooking | null;
  setBooking: (b: ActiveBooking | null) => void;
  history: HistoryRecord[];
  cancelBooking: () => void;
  bookingIntent: BookingIntent | null;
  setBookingIntent: (intent: BookingIntent | null) => void;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [booking, setBooking] = useState<ActiveBooking | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>(SEED_HISTORY);
  const [bookingIntent, setBookingIntent] = useState<BookingIntent | null>(null);

  function cancelBooking() {
    if (booking) {
      const record: HistoryRecord = {
        id: booking.id,
        doctorName: booking.doctor.name,
        doctorInitials: booking.doctor.initials,
        specialty: booking.doctor.specialty,
        date: booking.session.date,
        fee: booking.doctor.fee,
        status: "cancelled",
      };
      setHistory((prev) => [record, ...prev]);
    }
    setBooking(null);
  }

  return (
    <Ctx.Provider
      value={{
        patient,
        setPatient,
        booking,
        setBooking,
        history,
        cancelBooking,
        bookingIntent,
        setBookingIntent,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
