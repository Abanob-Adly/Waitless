import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { api } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";

// ── Types ────────────────────────────────────────────────────────────────────

type AppointmentStatus =
  | "pending_confirmation"
  | "booked"
  | "called"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

type QueueStatus = {
  token: string;
  patientName: string;
  queueNumber: number;
  position: number;
  totalInQueue: number;
  estimatedWaitMinutes: number;
  status: AppointmentStatus;
  sessionDate: string;
  sessionStatus: "scheduled" | "active" | "ended" | "cancelled";
  sessionClosureNote?: string;
  isOnBreak: boolean;
  doctorAvatarUrl: string;
  doctor: {
    name: string;
    specialty: string;
    area: string;
    consultationFee: number;
  };
};

// ── Page ─────────────────────────────────────────────────────────────────────

export function LiveTicket() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelPenalty, setCancelPenalty] = useState<{ applied: boolean; amount: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;

    async function fetchStatus() {
      try {
        const res = await api.get<{ data: Record<string, unknown> }>(
          `/appointments/track/${token}`,
        );
        const d = res.data.data;
        if (!alive) return;
        const queueNumber      = Number(d.queueNumber ?? 0);
        const currentlyServing = Number(d.currentlyServing ?? 0);
        // Prefer the server-computed position (active patients ahead + 1) which correctly
        // skips cancelled/no-show gaps. Fall back to the naive formula if backend is stale.
        const position = d.position != null
          ? Math.max(1, Number(d.position))
          : Math.max(1, queueNumber - currentlyServing);
        setQueueStatus({
          token: token,
          patientName:          String(d.patientName ?? ""),
          queueNumber,
          position,
          totalInQueue:         queueNumber,
          estimatedWaitMinutes: Number(d.estimatedWaitMin ?? 0),
          status:               String(d.status ?? "booked") as AppointmentStatus,
          sessionDate:          String(d.sessionDate ?? ""),
          sessionStatus:        (String(d.sessionStatus ?? "active") as QueueStatus["sessionStatus"]),
          isOnBreak:            Boolean(d.isOnBreak ?? false),
          doctorAvatarUrl:      String(d.doctorAvatarUrl ?? ""),
          doctor: {
            name:            String(d.doctorName ?? ""),
            specialty:       "",
            area:            "",
            consultationFee: Number(d.consultationFee ?? 0),
          },
        });
      } catch {
        // Leave stale state on transient error — blanking the ticket is worse than stale data.
      } finally {
        if (alive) setLoading(false);
      }
    }

    // Initial fetch
    void fetchStatus();

    // SSE for real-time updates.
    // Retries up to 3 times with 3/6/9 s backoff before falling back to 30 s polling.
    const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
    const sseUrl = `${apiBase}/appointments/track/${token}/sse`;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let retries = 0;
    let currentSSE: EventSource | null = null;

    function connectSSE() {
      const es = new EventSource(sseUrl);
      currentSSE = es;
      es.onmessage = () => { void fetchStatus(); };
      es.onerror = () => {
        es.close();
        if (!alive) return;
        if (retries < 3) {
          retries++;
          setTimeout(() => { if (alive) connectSSE(); }, retries * 3_000);
        } else if (!fallbackInterval) {
          fallbackInterval = setInterval(() => { void fetchStatus(); }, 30_000);
        }
      };
    }

    connectSSE();

    return () => {
      alive = false;
      currentSSE?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [token]);

  async function handleCancel() {
    if (!window.confirm("Are you sure you want to cancel? This cannot be undone.")) return;
    setCancelling(true);
    try {
      const cancelRes = await api.delete<{
        data: Record<string, unknown>;
        penaltyApplied: boolean;
        penaltyAmount: number;
      }>(`/appointments/track/${token}`);
      const { penaltyApplied, penaltyAmount } = cancelRes.data;
      setCancelPenalty({ applied: Boolean(penaltyApplied), amount: Number(penaltyAmount ?? 0) });
      // Re-fetch to get the authoritative cancelled status from the server
      const res = await api.get<{ data: Record<string, unknown> }>(
        `/appointments/track/${token}`,
      );
      const d = res.data.data;
      const queueNumber      = Number(d.queueNumber ?? 0);
      const currentlyServing = Number(d.currentlyServing ?? 0);
      setQueueStatus((prev) =>
        prev
          ? {
              ...prev,
              status: String(d.status ?? "cancelled") as AppointmentStatus,
              position: d.position != null
                ? Math.max(1, Number(d.position))
                : Math.max(1, queueNumber - currentlyServing),
            }
          : null,
      );
    } catch {
      // DELETE failed (already cancelled, network error) — navigate home gracefully
      navigate("/");
    } finally {
      setCancelling(false);
    }
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

  const canCancel = queueStatus.status === "booked" || queueStatus.status === "pending_confirmation";
  const today = new Date().toISOString().slice(0, 10);
  const isSessionDay = !queueStatus.sessionDate || queueStatus.sessionDate <= today;

  // ── Main render ──
  return (
    <div className="min-h-screen bg-offwhite">
      <Navbar />

      <main className="mx-auto max-w-md px-4 pb-16 pt-8">
        {/* Live sync indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          <span className="text-sm text-navy-mid">
            {isSessionDay ? "Live queue · syncing in real-time" : "Appointment confirmed · checking in…"}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-md">
          {/* Navy header band */}
          <div className="flex items-center justify-between bg-navy px-5 py-4">
            <div className="flex items-center gap-3">
              {queueStatus.doctorAvatarUrl ? (
                <img
                  src={queueStatus.doctorAvatarUrl}
                  alt={queueStatus.doctor.name}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 font-heading text-sm font-bold text-white">
                  {queueStatus.doctor.name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "Dr"}
                </div>
              )}
              <div>
                <p className="font-heading text-lg font-bold text-white">
                  {queueStatus.doctor.name}
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  {queueStatus.doctor.specialty} · {queueStatus.doctor.area}
                </p>
              </div>
            </div>

            {isSessionDay && queueStatus.sessionStatus === "active" && (
              <span className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-medium text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
            )}
          </div>

          {/* Status content */}
          <div className="px-5 pb-8 pt-6">
            {queueStatus.status === "pending_confirmation" ? (
              <PendingConfirmationView
                fee={queueStatus.doctor.consultationFee}
              />
            ) : !isSessionDay ? (
              <CountdownView sessionDate={queueStatus.sessionDate} />
            ) : queueStatus.sessionStatus === "ended" &&
              queueStatus.status !== "completed" &&
              queueStatus.status !== "cancelled" ? (
              <SessionEndedView />
            ) : (
              <>
                {queueStatus.status === "booked" && (
                  <WaitingView queueStatus={queueStatus} isOnBreak={queueStatus.isOnBreak} />
                )}
                {queueStatus.status === "called" && <CalledView />}
                {queueStatus.status === "in_progress" && <InProgressView />}
                {queueStatus.status === "completed" && <CompletedView token={queueStatus.token} />}
                {queueStatus.status === "cancelled" && (
                  <CancelledView
                    penaltyApplied={cancelPenalty?.applied}
                    penaltyAmount={cancelPenalty?.amount}
                  />
                )}
              </>
            )}
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

// ── Pending confirmation view ("pay at clinic" not yet confirmed by staff) ──

function PendingConfirmationView({ fee }: { fee: number }) {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold-tint text-4xl">
        🏥
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        Reserved — pay at reception
      </h2>
      <p className="mt-3 text-sm leading-6 text-navy-mid">
        Your spot is held, but you&apos;re not in the live queue yet. Pay the{" "}
        <span className="font-semibold text-gold">{fee} EGP</span> consultation
        fee at reception and staff will confirm it to add you to the queue.
      </p>
    </div>
  );
}

// ── Countdown view (session is in the future) ────────────────────────────────

function CountdownView({ sessionDate }: { sessionDate: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const session = new Date(sessionDate);
  session.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((session.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const formatted = session.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold-tint text-4xl">
        📅
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        {daysLeft === 1 ? "Tomorrow!" : `${daysLeft} days to go`}
      </h2>
      <p className="mt-3 text-sm text-navy-mid">
        Your appointment is scheduled for{" "}
        <span className="font-semibold text-navy">{formatted}</span>.
      </p>
      <p className="mt-2 text-xs text-navy-mid">
        Come back on the day of your appointment to track your queue position live.
      </p>
    </div>
  );
}

// ── Waiting view (status: "booked") ─────────────────────────────────────────

function WaitingView({ queueStatus, isOnBreak }: { queueStatus: QueueStatus; isOnBreak: boolean }) {
  const { t } = useLanguage();
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
      {queueStatus.sessionStatus === "scheduled" && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-navy/20 bg-navy/5 px-4 py-3">
          <span className="text-xl">⏳</span>
          <div>
            <p className="text-sm font-semibold text-navy">{t("Session not started yet")}</p>
            <p className="text-xs text-navy-mid">{t("The doctor has not started the session. You will be notified when it begins.")}</p>
          </div>
        </div>
      )}
      {isOnBreak && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-gold/40 bg-gold-tint px-4 py-3">
          <span className="text-xl">☕</span>
          <div>
            <p className="text-sm font-semibold text-navy">Doctor is on a break</p>
            <p className="text-xs text-navy-mid">The queue will resume shortly. Your position is held.</p>
          </div>
        </div>
      )}
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

function CompletedView({ token }: { token: string }) {
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
        to={`/review?token=${token}`}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-sm border border-gold px-6 text-sm font-medium text-gold transition hover:bg-gold-tint"
      >
        Rate Your Visit ★
      </Link>
      <Link
        to="/"
        className="mt-3 inline-flex h-10 items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-navy transition hover:bg-gold-light"
      >
        Book Another Appointment
      </Link>
    </div>
  );
}

// ── Session ended view (doctor ended the session before this patient) ────────

function SessionEndedView() {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-offwhite text-4xl">
        🕒
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        Session has ended
      </h2>
      <p className="mt-3 text-sm text-navy-mid">
        This doctor's session has closed. If you weren't seen, please contact
        the clinic reception to reschedule.
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

// ── Cancelled view (status: "cancelled") ────────────────────────────────────

function CancelledView({
  penaltyApplied,
  penaltyAmount,
}: {
  penaltyApplied?: boolean;
  penaltyAmount?: number;
}) {
  const { t } = useLanguage();
  return (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-4xl">
        ✕
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        {t("Appointment cancelled")}
      </h2>
      <p className="mt-3 text-sm text-navy-mid">
        {t("Your appointment has been cancelled. You can rebook at any time.")}
      </p>

      {penaltyApplied && (
        <div className="mt-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-left">
          <p className="text-sm font-semibold text-danger">
            {t("A late-cancellation fee of")} {penaltyAmount} EGP {t("has been deducted from your wallet.")}
          </p>
          <Link
            to="/dashboard"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-light"
          >
            {t("View wallet history")} →
          </Link>
        </div>
      )}

      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-sm bg-gold px-6 text-sm font-medium text-navy transition hover:bg-gold-light"
      >
        {t("Find Another Doctor")}
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
