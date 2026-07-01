import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ActiveBooking, HistoryRecord, BookingIntent } from "../types/index";
import { useAuth } from "./AuthContext";

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

function getBookingsKey(userId: string | undefined): string {
  return `waitless_bookings_${userId ?? "guest"}`;
}

function loadStoredBookings(key: string): ActiveBooking[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveBooking[];
      // Deduplicate by ID in case of corrupted previous state
      const seen = new Set<string>();
      return parsed.filter((b) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      });
    }
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
  const { authUser } = useAuth();
  const storageKey = getBookingsKey(authUser?.profile.id);

  const [bookings, setBookings] = useState<ActiveBooking[]>(() => loadStoredBookings(storageKey));
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [bookingIntent, setBookingIntent] = useState<BookingIntent | null>(null);

  // Prevents the persist effect from writing the previous user's bookings to the
  // new user's key in the same render cycle as a key change reload.
  const suppressPersistRef = useRef(false);

  // When the logged-in user changes (login / logout / account switch), reload
  // bookings from the correct user-scoped key so each account only sees its own tickets.
  useEffect(() => {
    suppressPersistRef.current = true;
    setBookings(loadStoredBookings(storageKey));
  }, [storageKey]);

  // Persist to the current user's scoped key on every change.
  useEffect(() => {
    if (suppressPersistRef.current) {
      suppressPersistRef.current = false;
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(bookings));
  }, [bookings, storageKey]);

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
    localStorage.removeItem(storageKey);
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
