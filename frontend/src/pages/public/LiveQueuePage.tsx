import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchQueueByToken } from "../../services/mockApi";
import type { Session } from "../../types/index";

type QueueEntry = {
  id: string;
  name: string;
  status: "waiting" | "serving" | "done" | "skipped" | "no_show";
  queueNumber: number;
  estimatedWaitMin: number;
};

type QueueData = {
  session: Session;
  doctorName: string;
  queue: QueueEntry[];
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function LiveQueuePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<QueueData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const result = await fetchQueueByToken(token);
    if (!result) {
      setNotFound(true);
    } else {
      setData(result as QueueData);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

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

  const { session, doctorName, queue } = data;
  const servingEntry = queue.find((p) => p.status === "serving");
  const waitingCount = queue.filter((p) => p.status === "waiting").length;

  const statusBadge: Record<string, string> = {
    waiting: "bg-gold-tint text-gold",
    serving: "bg-success/10 text-success",
    done:    "bg-border text-navy-mid",
    skipped: "bg-orange-50 text-orange-600",
    no_show: "bg-danger/10 text-danger",
  };

  return (
    <main className="min-h-[calc(100vh-64px)] bg-offwhite px-4 py-10">
      <div className="mx-auto max-w-lg space-y-5">
        {/* Header card */}
        <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="bg-navy px-6 py-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-gold">Live Queue</p>
            </div>
            <p className="mt-1 font-heading text-2xl font-bold text-white">{doctorName}</p>
            <p className="mt-0.5 text-sm text-white/60">
              {session.date} · {session.startTime} – {session.endTime}
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border px-0 py-0">
            <div className="py-4 text-center">
              <p className="font-heading text-3xl font-bold text-navy">{waitingCount}</p>
              <p className="mt-1 text-xs text-navy-mid">Waiting</p>
            </div>
            <div className="py-4 text-center">
              <p className="font-heading text-3xl font-bold text-gold">
                {servingEntry ? `#${servingEntry.queueNumber}` : "—"}
              </p>
              <p className="mt-1 text-xs text-navy-mid">Now Serving</p>
            </div>
            <div className="py-4 text-center">
              <p className={`font-heading text-3xl font-bold ${session.status === "active" ? "text-success" : "text-navy-mid"}`}>
                {session.status === "active" ? "Open" : session.status === "closed" ? "Closed" : "Scheduled"}
              </p>
              <p className="mt-1 text-xs text-navy-mid">Status</p>
            </div>
          </div>
        </div>

        {/* Queue list */}
        <div className="animate-fade-up overflow-hidden rounded-xl border border-border bg-white shadow-sm" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <p className="font-medium text-navy">Queue</p>
            <p className="text-xs text-navy-mid">{queue.length} total</p>
          </div>

          {queue.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-3xl">👥</p>
              <p className="mt-2 text-sm text-navy-mid">Queue is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {queue.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex animate-fade-up items-center gap-4 px-5 py-3.5 transition ${entry.status === "serving" ? "bg-gold-tint" : "hover:bg-offwhite"}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-bold text-sm ${
                    entry.status === "serving" ? "bg-gold text-navy" : "bg-offwhite text-navy"
                  }`}>
                    {entry.queueNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy">{entry.name}</p>
                    {entry.status === "waiting" && (
                      <p className="text-xs text-navy-mid">~{entry.estimatedWaitMin} min wait</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[entry.status] ?? ""}`}>
                    {entry.status === "no_show" ? "No-Show" : entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-navy-mid">
          Auto-refreshes every 5 seconds
        </p>
      </div>
    </main>
  );
}
