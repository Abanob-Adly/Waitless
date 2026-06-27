import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../services/api";

type TrackData = {
  queueNumber: number;
  currentlyServing: number;
  estimatedWaitMin: number;
  globalDelayMin?: number;
  status: string;
  sessionStatus?: string;
  sessionDate?: string;
  doctorName?: string;
  consultationFee?: number;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function LiveQueuePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const calledAtRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<{ data: TrackData }>(
        `/appointments/track/${token}`,
      );
      setData(res.data.data);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  // Track when status transitions to "called" and start 5-minute countdown
  useEffect(() => {
    if (data?.status === "called") {
      if (calledAtRef.current === null) {
        calledAtRef.current = Date.now();
        setSecondsLeft(300);
      }
    } else {
      calledAtRef.current = null;
      setSecondsLeft(300);
    }
  }, [data?.status]);

  useEffect(() => {
    if (calledAtRef.current === null) return;
    const timer = window.setInterval(() => {
      if (calledAtRef.current === null) return;
      const elapsed = Math.floor((Date.now() - calledAtRef.current) / 1000);
      setSecondsLeft(Math.max(0, 300 - elapsed));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [data?.status]);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite">
        <div className="flex items-center gap-2 text-navy-mid">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading queue…
        </div>
      </main>
    );
  }

  if (notFound || !data) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-white shadow-xl text-center">
          <div className="bg-navy px-8 py-7">
            <p className="font-heading text-sm font-medium text-gold">Waitless</p>
            <h1 className="mt-1 font-heading text-3xl font-bold text-white">Queue Not Found</h1>
          </div>
          <div className="px-8 py-10">
            <p className="text-5xl">🔍</p>
            <p className="mt-4 font-heading text-xl font-bold text-navy">
              Invalid or expired queue link
            </p>
            <p className="mt-2 text-sm text-navy-mid">
              This queue may have ended or the link is incorrect.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
            >
              Go Home →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { queueNumber, currentlyServing, estimatedWaitMin, status } = data;
  const position = Math.max(0, queueNumber - currentlyServing);
  const isCalled = status === "called" || status === "in_progress";
  const isDone = status === "completed" || status === "no_show" || status === "cancelled";
  const todayUtc = new Date().toISOString().slice(0, 10);
  const isFutureAppointment = data.sessionDate ? data.sessionDate > todayUtc : false;

  return (
    <main className="min-h-[calc(100vh-64px)] bg-offwhite px-4 py-10">
      <div className="mx-auto max-w-lg space-y-5">
        {isFutureAppointment ? (
          <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-tint text-3xl">📅</div>
              <p className="font-heading text-xl font-bold text-navy">Appointment Confirmed</p>
              <p className="mt-1 text-sm text-navy-mid">
                Scheduled for {data.sessionDate}{data.doctorName ? ` with Dr. ${data.doctorName}` : ""}.
              </p>
              <p className="mt-2 text-sm font-bold text-gold">Queue #{queueNumber}</p>
              <p className="mt-3 text-xs text-navy-mid">Live queue tracking opens on the day of your appointment.</p>
            </div>
          </div>
        ) : (
        <>
        {/* Header card */}
        <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="bg-navy px-6 py-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-gold">Live Queue Status</p>
            </div>
            <p className="mt-1 font-heading text-2xl font-bold text-white">Your Appointment</p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="py-5 text-center">
              <p className="font-heading text-3xl font-bold text-gold">#{queueNumber}</p>
              <p className="mt-1 text-xs text-navy-mid">Your Number</p>
            </div>
            <div className="py-5 text-center">
              <p className="font-heading text-3xl font-bold text-navy">
                {currentlyServing > 0 ? `#${currentlyServing}` : "—"}
              </p>
              <p className="mt-1 text-xs text-navy-mid">Now Serving</p>
            </div>
            <div className="py-5 text-center">
              <p className="font-heading text-3xl font-bold text-navy">
                {position > 0 ? position : "—"}
              </p>
              <p className="mt-1 text-xs text-navy-mid">Ahead of You</p>
            </div>
          </div>
        </div>

        {/* Status card */}
        <div
          className="animate-fade-up overflow-hidden rounded-xl border bg-white shadow-sm"
          style={{ animationDelay: "80ms" }}
        >
          {isCalled ? (
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl">
                🔔
              </div>
              <p className="font-heading text-xl font-bold text-navy">It's your turn!</p>
              <p className="mt-1 text-sm text-navy-mid">Please proceed to the doctor's room.</p>
              {status === "called" && secondsLeft > 0 && (
                <p className="mt-3 text-sm text-navy-mid">
                  Please arrive within{" "}
                  <span className="font-semibold text-gold">
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                  {" "}or your spot may be given away.
                </p>
              )}
              {status === "called" && secondsLeft === 0 && (
                <p className="mt-3 text-sm text-danger">
                  Time window passed — you may be skipped.
                </p>
              )}
            </div>
          ) : isDone ? (
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-border text-3xl">
                ✓
              </div>
              <p className="font-heading text-xl font-bold text-navy">Appointment Finished</p>
              <p className="mt-1 text-sm text-navy-mid capitalize">{status.replace("_", " ")}</p>
            </div>
          ) : (
            <div className="flex items-center justify-between border-border px-6 py-5">
              <div>
                <p className="font-medium text-navy">Estimated Wait</p>
                <p className="mt-0.5 text-sm text-navy-mid">
                  {estimatedWaitMin > 0 ? `~${estimatedWaitMin} minutes` : "Calculating…"}
                </p>
              </div>
              <span className="rounded-full bg-gold-tint px-3 py-1.5 text-sm font-semibold text-gold">
                Waiting
              </span>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-navy-mid">
          Auto-refreshes every 5 seconds
        </p>
        </>
        )}
      </div>
    </main>
  );
}
