import { useState, useEffect } from "react";
import type { ActiveBooking } from "../../App";

// ── Props ─────────────────────────────────────────────────────────────────────

type LiveTicketProps = {
  booking: ActiveBooking;
  onCancel: () => void;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export function LiveTicket({ booking, onCancel }: LiveTicketProps) {
  // Queue simulation: start serving 3 patients behind the patient's number.
  // Every 5 seconds the server advances one — the patient watches their
  // position drop in real-time until they're called.
  const initialServing = Math.max(0, booking.queueNumber - 3);
  const [currentServing, setCurrentServing] = useState(initialServing);
  const [cancelling, setCancelling] = useState(false);

  // Simulate queue progression (replace with WebSocket subscription when backend is ready)
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentServing((prev) => {
        if (prev >= booking.queueNumber) return prev; // stop once patient is called
        return prev + 1;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [booking.queueNumber]);

  // Derived state
  const position = Math.max(0, booking.queueNumber - currentServing);
  const etaMinutes = position * 12;
  const isCalled = position === 0;

  // SVG arc progress: 0 when just joined, 1 when called
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const initialPosition = booking.queueNumber - initialServing; // e.g. 3
  const progress =
    initialPosition > 0 ? 1 - position / initialPosition : 1;
  const strokeDashoffset = circumference * (1 - progress);

  async function handleCancel() {
    if (
      !window.confirm(
        "Are you sure you want to cancel your appointment? This cannot be undone.",
      )
    )
      return;
    setCancelling(true);
    await new Promise((r) => setTimeout(r, 800)); // Simulates DELETE /api/appointments/:id
    onCancel();
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-8">
      {/* Live sync indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
        <span className="text-sm text-navy-mid">
          Live queue · syncing in real-time
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-md">
        {/* ── Navy header ── */}
        <div className="flex items-center justify-between bg-navy px-5 py-4">
          <div>
            <p className="font-heading text-lg font-bold text-white">
              {booking.doctor.name}
            </p>
            <p className="mt-0.5 text-xs text-white/60">
              {booking.doctor.specialty} · {booking.doctor.area}
            </p>
          </div>

          <span className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-medium text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        </div>

        {/* ── Status content ── */}
        <div className="px-5 pb-8 pt-6">
          {isCalled ? (
            <CalledView />
          ) : (
            <WaitingView
              position={position}
              currentServing={currentServing}
              etaMinutes={etaMinutes}
              fee={booking.doctor.fee}
              circumference={circumference}
              strokeDashoffset={strokeDashoffset}
              radius={radius}
            />
          )}
        </div>

        {/* ── Cancel button ── */}
        {!isCalled && (
          <div className="border-t border-border px-5 pb-6">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full rounded-sm border border-danger/30 py-3 text-sm font-medium text-danger transition hover:bg-danger/5 disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel My Booking"}
            </button>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-navy-mid">
        Keep this page open to track your position in real-time.
      </p>
    </main>
  );
}

// ── Waiting view ──────────────────────────────────────────────────────────────

type WaitingViewProps = {
  position: number;
  currentServing: number;
  etaMinutes: number;
  fee: number;
  circumference: number;
  strokeDashoffset: number;
  radius: number;
};

function WaitingView({
  position,
  currentServing,
  etaMinutes,
  fee,
  circumference,
  strokeDashoffset,
  radius,
}: WaitingViewProps) {
  return (
    <div>
      <p className="mb-5 text-center text-sm font-medium text-navy-mid">
        Your position in queue
      </p>

      {/* Circular SVG ring — the core visual from the design system */}
      <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 180 180"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#DDD8CC"
            strokeWidth="8"
          />
          {/* Gold progress arc */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#C9922A"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 1.2s ease" }}
          />
        </svg>

        {/* Position number */}
        <span className="font-heading text-7xl font-bold leading-none text-navy">
          {position}
        </span>
      </div>

      {/* Currently serving indicator */}
      <p className="mt-4 text-center text-sm text-navy-mid">
        Currently serving{" "}
        <span className="font-semibold text-navy">#{currentServing}</span>
      </p>

      {/* ETA + Fee stats */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <StatBox
          label="Est. wait"
          value={`~${etaMinutes}m`}
          accent
        />
        <StatBox label="Consult fee" value={`${fee} EGP`} />
      </div>
    </div>
  );
}

// ── Called view ───────────────────────────────────────────────────────────────

function CalledView() {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 animate-bounce items-center justify-center rounded-full bg-gold-tint text-4xl">
        🔔
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        It&apos;s your turn!
      </h2>
      <p className="mt-3 text-sm leading-6 text-navy-mid">
        Please proceed to reception within{" "}
        <span className="font-semibold text-gold">5 minutes</span> or your spot
        may be given to the next patient.
      </p>
      <div className="mt-5 rounded-md bg-gold-tint px-4 py-3">
        <p className="text-sm font-medium text-navy">
          Show this screen at the reception desk
        </p>
      </div>
    </div>
  );
}

// ── Stat box ──────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md p-4 text-center ${
        accent ? "bg-gold-tint" : "bg-offwhite"
      }`}
    >
      <p
        className={`font-heading text-2xl font-bold ${
          accent ? "text-gold" : "text-navy"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-navy-mid">{label}</p>
    </div>
  );
}
