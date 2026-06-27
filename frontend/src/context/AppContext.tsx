import { createContext, useContext, useState, useEffect } from "react";
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

const BOOKINGS_KEY = "waitless_bookings";

function loadStoredBookings(): ActiveBooking[] {
  try {
    const raw = localStorage.getItem(BOOKINGS_KEY);
    if (raw) return JSON.parse(raw) as ActiveBooking[];
  } catch { /* corrupted */ }
  return [];
}

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
  const [bookings, setBookings] = useState<ActiveBooking[]>(loadStoredBookings);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [bookingIntent, setBookingIntent] = useState<BookingIntent | null>(null);

  useEffect(() => {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  }, [bookings]);

  function addBooking(b: ActiveBooking) {
    setBookings((prev) => {
      const exists = prev.some((x) => x.id === b.id);
      return exists ? prev : [...prev, b];
    });
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
    localStorage.removeItem(BOOKINGS_KEY);
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
