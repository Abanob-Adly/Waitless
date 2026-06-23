import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";

// ── Types ────────────────────────────────────────────────────────────────────

type AppointmentStatus =
  | "booked"
  | "called"
  | "in_progress"
  | "completed"
  | "cancelled";

type QueueStatus = {
  appointmentId: string;
  patientName: string;
  queueNumber: number;
  position: number;       // live rank among non-cancelled patients
  totalInQueue: number;   // used to calculate the SVG arc progress
  estimatedWaitMinutes: number;
  status: AppointmentStatus;
  sessionStatus: "scheduled" | "active" | "ended";
  doctor: {
    name: string;
    specialty: string;
    area: string;
    consultationFee: number;
  };
};

// ── Mock API ─────────────────────────────────────────────────────────────────
// Simulates: GET /api/appointments/:id/queue-status  (Flow 15)
// Replace with: axios.get(`/api/appointments/${id}/queue-status`)

async function fetchQueueStatus(
  appointmentId: string,
): Promise<QueueStatus | null> {
  await new Promise((r) => setTimeout(r, 400));
  if (appointmentId !== "booking-001") return null;
  return {
    appointmentId: "booking-001",
    patientName: "Ahmed Mohamed",
    queueNumber: 3,
    position: 3,
    totalInQueue: 7,
    estimatedWaitMinutes: 36,
    status: "booked",
    sessionStatus: "active",
    doctor: {
      name: "Dr. Layla Hassan",
      specialty: "Cardiology",
      area: "Maadi Clinic",
      consultationFee: 350,
    },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function LiveTicket() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    let alive = true;

    async function poll() {
      const data = await fetchQueueStatus(appointmentId!);
      if (!alive) return;
      setQueueStatus(data);
      setLoading(false);
    }

    poll();
    // Poll every 15 s — replace with WebSocket subscription when backend is ready
    const id = setInterval(poll, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [appointmentId]);

  // Flow 14 — Patient Cancellation
  async function handleCancel() {
    if (
      !window.confirm(
        "Are you sure you want to cancel? This cannot be undone.",
      )
    )
      return;
    setCancelling(true);
    // Simulates: DELETE /api/appointments/:id
    await new Promise((r) => setTimeout(r, 800));
    navigate("/");
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-offwhite">
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-gold" />
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!queueStatus) {
    return (
      <div className="min-h-screen bg-offwhite">
        <Navbar />
        <main className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="font-heading text-2xl font-bold text-navy">
            Ticket not found
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-medium text-gold hover:text-gold-light"
          >
            ← Back to home
          </Link>
        </main>
      </div>
    );
  }

  const canCancel = queueStatus.status === "booked";

  // ── Main render ──
  return (
    <div className="min-h-screen bg-offwhite">
      <Navbar />

      <main className="mx-auto max-w-md px-4 pb-16 pt-8">
        {/* Live sync indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          <span className="text-sm text-navy-mid">
            Live queue · syncing in real-time
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-md">
          {/* Navy header band */}
          <div className="flex items-center justify-between bg-navy px-5 py-4">
            <div>
              <p className="font-heading text-lg font-bold text-white">
                {queueStatus.doctor.name}
              </p>
              <p className="mt-0.5 text-xs text-white/60">
                {queueStatus.doctor.specialty} · {queueStatus.doctor.area}
              </p>
            </div>

            {queueStatus.sessionStatus === "active" && (
              <span className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-medium text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
            )}
          </div>

          {/* Status content */}
          <div className="px-5 pb-8 pt-6">
            {queueStatus.status === "booked" && (
              <WaitingView queueStatus={queueStatus} />
            )}
            {queueStatus.status === "called" && <CalledView />}
            {queueStatus.status === "in_progress" && <InProgressView />}
            {queueStatus.status === "completed" && <CompletedView />}
            {queueStatus.status === "cancelled" && <CancelledView />}
          </div>

          {/* Cancel button — Flow 14 */}
          {canCancel && (
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
    </div>
  );
}

// ── Waiting view (status: "booked") ─────────────────────────────────────────

function WaitingView({ queueStatus }: { queueStatus: QueueStatus }) {
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  // Arc progress: 0 = first in queue, 1 = all ahead have been served
  const progress = Math.max(
    0,
    1 - (queueStatus.position - 1) / queueStatus.totalInQueue,
  );
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div>
      <p className="mb-5 text-center text-sm font-medium text-navy-mid">
        Your position in queue
      </p>

      {/* Circular SVG ring */}
      <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 180 180"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#DDD8CC"
            strokeWidth="8"
          />
          {/* Gold arc */}
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

        <span className="font-heading text-7xl font-bold leading-none text-navy">
          {queueStatus.position}
        </span>
      </div>

      {/* ETA + Fee */}
      <div className="mt-8 grid grid-cols-2 gap-3">
        <StatBox
          label="Est. wait"
          value={`~${queueStatus.estimatedWaitMinutes}m`}
          accent
        />
        <StatBox
          label="Consult fee"
          value={`${queueStatus.doctor.consultationFee} EGP`}
        />
      </div>
    </div>
  );
}

// ── Called view (status: "called") ──────────────────────────────────────────

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

// ── In-progress view (status: "in_progress") ────────────────────────────────

function InProgressView() {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-4xl">
        🩺
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        You&apos;re in session
      </h2>
      <p className="mt-3 text-sm text-navy-mid">
        Your consultation is currently in progress.
      </p>
    </div>
  );
}

// ── Completed view (status: "completed") ────────────────────────────────────

function CompletedView() {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-4xl">
        ✅
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        Visit complete
      </h2>
      <p className="mt-3 text-sm text-navy-mid">
        Thank you for visiting. We hope you feel better soon!
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-navy transition hover:bg-gold-light"
      >
        Book Another Appointment
      </Link>
    </div>
  );
}

// ── Cancelled view (status: "cancelled") ────────────────────────────────────

function CancelledView() {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-4xl">
        ✕
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        Appointment cancelled
      </h2>
      <p className="mt-3 text-sm text-navy-mid">
        Your appointment has been cancelled. You can rebook at any time.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-navy transition hover:bg-gold-light"
      >
        Find Another Doctor
      </Link>
    </div>
  );
}

// ── Stat box ─────────────────────────────────────────────────────────────────

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
      className={`rounded-md p-4 text-center ${accent ? "bg-gold-tint" : "bg-offwhite"}`}
    >
      <p
        className={`font-heading text-2xl font-bold ${accent ? "text-gold" : "text-navy"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-navy-mid">{label}</p>
    </div>
  );
}
