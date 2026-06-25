import { createContext, useContext, useState } from "react";
import type { ActiveBooking, HistoryRecord, BookingIntent } from "../types/index";

// Re-export all canonical types so existing consumers don't need to change their imports
export type {
  Patient,
  PatientProfile,
  DoctorAccount,
  AuthRole,
  AuthUser,
  PatientSignupPayload,
  DoctorSignupPayload,
  ClinicLocation,
  Doctor,
  Session,
  ActiveBooking,
  HistoryRecord,
  BookingIntent,
  BookingPayload,
  PaymentPayload,
  PaymentRecord,
} from "../types/index";

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

// ── Context type ──────────────────────────────────────────────────────────────

type AppCtx = {
  bookings: ActiveBooking[];
  addBooking: (b: ActiveBooking) => void;
  removeBooking: (id: string) => void;
  updateBookingNotes: (id: string, notes: string) => void;
  clearBookings: () => void;
  history: HistoryRecord[];
  bookingIntent: BookingIntent | null;
  setBookingIntent: (intent: BookingIntent | null) => void;
};

const Ctx = createContext<AppCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<ActiveBooking[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>(SEED_HISTORY);
  const [bookingIntent, setBookingIntent] = useState<BookingIntent | null>(null);

  function addBooking(b: ActiveBooking) {
    setBookings((prev) => [...prev, b]);
  }

  function removeBooking(id: string) {
    const found = bookings.find((b) => b.id === id);
    if (found) {
      setHistory((h) => [
        {
          id: found.id,
          doctorName: found.doctor.name,
          doctorInitials: found.doctor.initials,
          specialty: found.doctor.specialty,
          date: found.session.date,
          fee: found.doctor.fee,
          status: "cancelled",
        },
        ...h,
      ]);
    }
    setBookings((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBookingNotes(id: string, notes: string) {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, patientNotes: notes } : b)),
    );
  }

  function clearBookings() {
    setBookings([]);
  }

  return (
    <Ctx.Provider
      value={{
        bookings,
        addBooking,
        removeBooking,
        updateBookingNotes,
        clearBookings,
        history,
        bookingIntent,
        setBookingIntent,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
