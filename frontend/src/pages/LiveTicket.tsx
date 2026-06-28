import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useQueueSubscription } from "../hooks/useQueueSubscription";
import { api } from "../services/api";
import type { ActiveBooking } from "../context/AppContext";

// ── Page ──────────────────────────────────────────────────────────────────────

export function LiveTicket() {
  const { bookings, removeBooking } = useApp();
  const navigate = useNavigate();

  // Show the first active booking
  const booking = bookings[0] ?? null;

  if (!booking) return <NoTicketView />;

  return (
    <TicketView
      booking={booking}
      onCancel={() => {
        removeBooking(booking.id);
        navigate("/");
      }}
    />
  );
}

// ── Live ticket view ──────────────────────────────────────────────────────────

function TicketView({
  booking,
  onCancel,
}: {
  booking: ActiveBooking;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);

  const trackingToken = booking.accessToken ?? booking.id;
  const { position, currentServing, etaMinutes, isCalled, sessionDate } =
    useQueueSubscription(
      trackingToken,
      booking.queueNumber,
      booking.session.avgConsultationMin,
    );

  // Use booking's stored date as fallback until backend confirms sessionDate
  const effectiveDate = sessionDate || booking.session.date || "";
  const now = new Date();
  const todayLocal = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const isSessionDay = !effectiveDate || effectiveDate === todayLocal;

  // SVG ring geometry — initialGap is fixed at 3 (hook starts 3 behind)
  const R = 68;
  const circumference = 2 * Math.PI * R;
  const initialGap = 3;
  const progress = initialGap > 0 ? 1 - position / initialGap : 1;
  const dashOffset = circumference * (1 - progress);

  // Clinic address from doctor clinics list
  const clinicDetails = booking.doctor.clinics.find(
    (c) => c.id === booking.session.clinicId,
  );

  const paymentBadge = {
    success: { label: "Paid ✓", cls: "bg-success/10 text-success" },
    failed: { label: "Payment Failed", cls: "bg-danger/10 text-danger" },
    pending: { label: "Pay at Clinic", cls: "bg-gold-tint text-navy" },
  }[booking.paymentStatus];

  async function handleCancel() {
    if (!window.confirm("Cancel your appointment? This cannot be undone."))
      return;
    setCancelling(true);
    // Best-effort cancel — if it fails the booking is removed from local state anyway
    try {
      await api.delete(`/appointments/${booking.id}`);
    } catch {
      // ignore — booking was cancelled locally
    }
    onCancel();
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
      {/* Live / scheduled indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isSessionDay ? "animate-pulse bg-success" : "bg-gold"}`} />
        <span className="text-sm text-navy-mid">
          {isSessionDay ? "Live queue · syncing in real-time" : "Appointment confirmed · awaiting session day"}
        </span>
      </div>

      {/* Ticket card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        {/* ── Navy header ── */}
        <div className="flex items-center justify-between bg-navy px-6 py-5">
          <div>
            <p className="font-heading text-xl font-bold text-white">
              {booking.doctor.name}
            </p>
            <p className="mt-0.5 text-sm text-white/60">
              {booking.doctor.specialty} · {booking.doctor.area}
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              {booking.session.clinicName}
            </p>
            {clinicDetails?.address && (
              <p className="mt-0.5 text-xs text-white/30">
                📍 {clinicDetails.address}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>
            <p className="text-xs text-white/40">{booking.session.date}</p>
            <p className="text-xs text-white/40">
              {booking.session.startTime} – {booking.session.endTime}
            </p>
          </div>
        </div>

        {/* ── Queue position area ── */}
        <div className="px-6 pb-2 pt-6">
          {!isSessionDay ? (
            <CountdownView sessionDate={effectiveDate} />
          ) : isCalled ? (
            <CalledView />
          ) : (
            <WaitingView
              position={position}
              queueNumber={booking.queueNumber}
              currentServing={currentServing}
              etaMinutes={etaMinutes}
              circumference={circumference}
              dashOffset={dashOffset}
              R={R}
            />
          )}
        </div>

        {/* ── Payment + fee row ── */}
        <div className="mx-6 mb-2 flex items-center justify-between rounded-lg border border-border bg-offwhite px-4 py-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge.cls}`}
          >
            {paymentBadge.label}
          </span>
          <span className="font-heading text-base font-bold text-navy">
            {booking.doctor.fee} EGP
          </span>
        </div>

        {/* ── Patient notes preview ── */}
        {booking.patientNotes && (
          <div className="mx-6 mb-2 rounded-lg bg-gold-tint px-4 py-2.5 text-xs text-navy-mid">
            <span className="font-medium text-navy">Note: </span>
            {booking.patientNotes.slice(0, 80)}
            {booking.patientNotes.length > 80 ? "…" : ""}
          </div>
        )}

        {/* ── Cancel button (only available on the session day while not yet called) ── */}
        {isSessionDay && !isCalled && (
          <div className="px-6 pb-6 pt-2">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full rounded-md border border-danger/30 bg-white py-3 text-sm font-medium text-danger transition hover:bg-danger hover:text-white disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel My Booking"}
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="pb-5 text-center text-xs text-navy-mid">
          Keep this page open to track your position.
        </p>
      </div>

      {/* Dashboard link */}
      <p className="mt-6 text-center text-sm text-navy-mid">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-gold underline underline-offset-2 transition hover:text-gold-light"
        >
          View in My Dashboard →
        </button>
      </p>
    </main>
  );
}

// ── Countdown view (appointment is in the future) ────────────────────────────

function CountdownView({ sessionDate }: { sessionDate: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const session = new Date(sessionDate + "T00:00:00");
  session.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((session.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const formatted = session.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gold-tint text-5xl">
        📅
      </div>
      <h2 className="font-heading text-3xl font-bold text-navy">
        {daysLeft <= 0 ? "Today!" : daysLeft === 1 ? "Tomorrow!" : `${daysLeft} days to go`}
      </h2>
      <p className="mt-4 text-sm leading-6 text-navy-mid">
        Your appointment is scheduled for{" "}
        <span className="font-semibold text-navy">{formatted}</span>.
      </p>
      <p className="mt-2 text-xs text-navy-mid">
        Return on the day of your appointment to track your live queue position.
      </p>
    </div>
  );
}

// ── Waiting view ──────────────────────────────────────────────────────────────

type WaitingViewProps = {
  position: number;
  queueNumber: number;
  currentServing: number;
  etaMinutes: number;
  circumference: number;
  dashOffset: number;
  R: number;
};

function WaitingView({
  position,
  queueNumber,
  currentServing,
  etaMinutes,
  circumference,
  dashOffset,
  R,
}: WaitingViewProps) {
  return (
    <div>
      <div className="mb-4 flex justify-center">
        <span className="rounded-full bg-navy px-4 py-1.5 text-sm font-medium text-white/70">
          Your number:{" "}
          <span className="font-bold text-gold">#{queueNumber}</span>
        </span>
      </div>

      <p className="mb-4 text-center text-sm font-medium text-navy-mid">
        Your position in queue
      </p>

      {/* SVG circular ring */}
      <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 180 180"
          aria-hidden="true"
        >
          <circle
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke="#DDD8CC"
            strokeWidth="10"
          />
          <circle
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke="#C9922A"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1.2s ease" }}
          />
        </svg>
        <div className="text-center">
          <span className="font-heading text-7xl font-bold leading-none text-navy">
            {position}
          </span>
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-navy-mid">
        Currently serving{" "}
        <span className="font-semibold text-navy">#{currentServing}</span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gold-tint p-4 text-center">
          <p className="font-heading text-2xl font-bold text-gold">
            ~{etaMinutes}m
          </p>
          <p className="mt-1 text-xs font-medium text-navy-mid">
            Estimated wait
          </p>
        </div>
        <div className="rounded-xl bg-offwhite p-4 text-center">
          <p className="font-heading text-2xl font-bold text-navy">
            #{currentServing}
          </p>
          <p className="mt-1 text-xs font-medium text-navy-mid">
            Now serving
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Called view ───────────────────────────────────────────────────────────────

function CalledView() {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-5 flex h-24 w-24 animate-bounce items-center justify-center rounded-full bg-gold-tint text-5xl">
        🔔
      </div>
      <h2 className="font-heading text-3xl font-bold text-navy">
        It&apos;s your turn!
      </h2>
      <p className="mt-4 text-sm leading-6 text-navy-mid">
        Please proceed to reception within{" "}
        <span className="font-semibold text-gold">5 minutes</span> or your
        spot may be given to the next patient.
      </p>
      <div className="mt-6 rounded-xl bg-gold-tint px-5 py-4">
        <p className="font-medium text-navy">
          Show this screen at the reception desk
        </p>
        <p className="mt-1 text-xs text-navy-mid">
          Reception staff will note your details
        </p>
      </div>
    </div>
  );
}

// ── No ticket view ────────────────────────────────────────────────────────────

function NoTicketView() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-md px-6 py-28 text-center">
      <p className="text-6xl">🎫</p>
      <h2 className="mt-5 font-heading text-3xl font-bold text-navy">
        No active ticket
      </h2>
      <p className="mt-3 text-sm leading-6 text-navy-mid">
        You don&apos;t have an active booking. Find a doctor and book an
        appointment to receive your live queue ticket.
      </p>
      <button
        onClick={() => navigate("/search")}
        className="mt-8 rounded-md bg-gold px-8 py-3 text-sm font-medium text-navy transition hover:bg-gold-light"
      >
        Find a Doctor
      </button>
    </main>
  );
}
