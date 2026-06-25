import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";
import { Tabs } from "../../components/ui/Tabs";
import {
  fetchSessionsForBranch,
  openSession,
  closeSession,
  lookupPatientByPhone,
  walkInBooking,
  fetchDoctorQueue,
  skipPatient,
  markNoShow,
  checkInPatient,
} from "../../services/mockApi";
import type { Session } from "../../types/index";

type QueueEntry = {
  id: string;
  name: string;
  status: "waiting" | "serving" | "done" | "skipped" | "no_show";
  queueNumber: number;
  estimatedWaitMin: number;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function ReceptionistDashboard() {
  const { authUser, logout } = useAuth();
  const navigate = useNavigate();
  const { isLoading } = useOrg();

  if (!authUser || authUser.role !== "receptionist") {
    navigate("/login", { replace: true });
    return null;
  }

  const rec = authUser.profile;

  const tabs = [
    { id: "sessions", label: "Today's Sessions", content: <SessionsTab branchId={rec.branchId} /> },
    { id: "walkin",   label: "Walk-In",           content: <WalkInTab branchId={rec.branchId} /> },
    { id: "checkin",  label: "Check-In",           content: <CheckInTab branchId={rec.branchId} /> },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex animate-fade-up items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gold">Reception Portal</p>
          <h1 className="font-heading text-4xl font-bold text-navy">
            {isLoading ? "Loading…" : "Reception Desk"}
          </h1>
          <p className="mt-1 text-sm text-navy-mid">
            {rec.name} · Receptionist
          </p>
        </div>
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="rounded-md border border-border px-4 py-2 text-sm text-navy-mid transition hover:border-danger/40 hover:text-danger"
        >
          Sign Out
        </button>
      </div>

      <section className="animate-fade-up rounded-xl border border-border bg-white p-6 shadow-sm" style={{ animationDelay: "100ms" }}>
        <Tabs items={tabs} defaultTab="sessions" />
      </section>
    </main>
  );
}

// ── Today's Sessions Tab ──────────────────────────────────────────────────────

function SessionsTab({ branchId }: { branchId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    const result = await fetchSessionsForBranch(branchId, today);
    setSessions(result);
    setLoading(false);
  }, [branchId, today]);

  useEffect(() => { void load(); }, [load]);

  async function handleStart(sessionId: string) {
    await openSession(sessionId);
    await load();
  }

  async function handleClose(sessionId: string) {
    await closeSession(sessionId);
    setConfirmClose(null);
    await load();
  }

  if (loading) return <Skeleton />;

  const statusBadge: Record<string, string> = {
    scheduled: "bg-gold-tint text-gold",
    active:    "bg-success/10 text-success",
    closed:    "bg-border text-navy-mid",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy-mid">
        {sessions.length} session{sessions.length !== 1 ? "s" : ""} for {today}
      </p>

      {sessions.length === 0 ? (
        <EmptyState icon="📋" title="No sessions today" body="Sessions for today will appear here." />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {sessions.map((s) => (
            <div key={s.id}>
              <div className="flex items-start justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-navy">{s.doctorName}</p>
                  <p className="text-sm text-navy-mid">{s.specialty}</p>
                  <p className="text-xs text-navy-mid">
                    {s.date} · {s.startTime} – {s.endTime}
                  </p>
                  <p className="mt-1 text-xs text-navy-mid">
                    Token: <span className="font-mono">{s.queueToken}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[s.status] ?? ""}`}>
                    {s.status}
                  </span>
                  <div className="flex gap-2">
                    {s.status === "scheduled" && (
                      <button
                        onClick={() => handleStart(s.id)}
                        className="rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-navy transition hover:bg-gold-light"
                      >
                        Start Session
                      </button>
                    )}
                    {s.status === "active" && (
                      <>
                        <button
                          onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs text-navy-mid transition hover:border-navy hover:text-navy"
                        >
                          {expandedId === s.id ? "Hide Queue" : "View Queue"}
                        </button>
                        <button
                          onClick={() => setConfirmClose(s.id)}
                          className="rounded-md border border-danger/30 px-3 py-1.5 text-xs text-danger transition hover:bg-danger/5"
                        >
                          End Session
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {expandedId === s.id && s.status === "active" && (
                <div className="border-t border-border bg-offwhite px-5 py-4">
                  <SessionQueuePanel doctorId={s.doctorId} sessionId={s.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 animate-fade-in bg-navy/60 backdrop-blur-sm" onClick={() => setConfirmClose(null)} />
          <div className="relative mx-4 w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl p-6">
            <p className="font-heading text-xl font-bold text-navy">End Session?</p>
            <p className="mt-2 text-sm text-navy-mid">
              Remaining waiting patients will be removed from the queue.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmClose(null)}
                className="flex h-10 flex-1 items-center justify-center rounded-md border border-border text-sm text-navy-mid transition hover:border-navy"
              >
                Cancel
              </button>
              <button
                onClick={() => handleClose(confirmClose)}
                className="flex h-10 flex-1 items-center justify-center rounded-md bg-danger text-sm font-medium text-white transition hover:bg-danger/80"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Walk-In Tab ───────────────────────────────────────────────────────────────

type PatientLookup = {
  id: string;
  name: string;
  phone: string;
};

function WalkInTab({ branchId }: { branchId: string }) {
  const [phone, setPhone] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [foundPatient, setFoundPatient] = useState<PatientLookup | null | "not_found">(null);
  const [newPatientName, setNewPatientName] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<{ queueNumber: number; appointmentId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchSessionsForBranch(branchId, today).then((s) => {
      const active = s.filter((x) => x.status === "active");
      setSessions(active);
      if (active.length > 0) setSelectedSession(active[0].id);
    });
  }, [branchId, today]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLookingUp(true);
    setResult(null);
    setFoundPatient(null);
    setError(null);
    const p = await lookupPatientByPhone(phone.trim());
    if (p) {
      setFoundPatient({ id: p.id, name: p.name, phone: p.phone });
    } else {
      setFoundPatient("not_found");
    }
    setLookingUp(false);
  }

  async function handleWalkIn() {
    const session = sessions.find((s) => s.id === selectedSession);
    if (!session) { setError("Please select an active session."); return; }

    const patientId =
      foundPatient && foundPatient !== "not_found"
        ? foundPatient.id
        : `walkin-${Date.now()}`;

    setAdding(true);
    setError(null);
    try {
      const res = await walkInBooking({
        sessionId: session.id,
        doctorId: session.doctorId,
        patientId,
        avgConsultationMin: 12,
      });
      setResult(res);
      setPhone("");
      setFoundPatient(null);
      setNewPatientName("");
    } catch {
      setError("Failed to add patient to queue.");
    }
    setAdding(false);
  }

  return (
    <div className="space-y-5">
      {result && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-5 py-4">
          <p className="font-medium text-success">Patient added to queue</p>
          <p className="mt-1 text-2xl font-bold text-navy">#{result.queueNumber}</p>
          <p className="text-xs text-navy-mid">Queue number assigned</p>
        </div>
      )}

      <form onSubmit={handleLookup} className="flex gap-3">
        <input
          type="text"
          placeholder="Patient phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          className="h-11 flex-1 rounded-md border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <button
          type="submit"
          disabled={lookingUp}
          className="rounded-md bg-gold px-5 py-2 text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
        >
          {lookingUp ? "Looking up…" : "Look Up"}
        </button>
      </form>

      {foundPatient === "not_found" && (
        <div className="rounded-lg border border-border bg-offwhite p-4">
          <p className="text-sm font-medium text-navy">Patient not found</p>
          <p className="text-xs text-navy-mid">Enter name for a new walk-in record:</p>
          <input
            type="text"
            placeholder="Patient full name"
            value={newPatientName}
            onChange={(e) => setNewPatientName(e.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>
      )}

      {foundPatient && foundPatient !== "not_found" && (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 font-bold text-success">
            {foundPatient.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-navy">{foundPatient.name}</p>
            <p className="text-xs text-navy-mid">{foundPatient.phone}</p>
          </div>
          <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">Found</span>
        </div>
      )}

      {sessions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-navy">Active Session</label>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.doctorName} · {s.startTime}–{s.endTime}
              </option>
            ))}
          </select>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="rounded-lg border border-border bg-offwhite px-4 py-3 text-sm text-navy-mid">
          No active sessions. Start a session in the "Today's Sessions" tab first.
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {foundPatient !== null && sessions.length > 0 && (
        <button
          onClick={handleWalkIn}
          disabled={adding}
          className="h-11 w-full rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
        >
          {adding ? "Adding…" : "Add to Queue →"}
        </button>
      )}
    </div>
  );
}

// ── Check-In Tab ──────────────────────────────────────────────────────────────

function CheckInTab({ branchId }: { branchId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [queues, setQueues] = useState<Record<string, QueueEntry[]>>({});

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    setLoading(true);
    const all = await fetchSessionsForBranch(branchId, today);
    const active = all.filter((s) => s.status === "active");
    setSessions(active);

    const queueMap: Record<string, QueueEntry[]> = {};
    await Promise.all(
      active.map(async (s) => {
        const q = await fetchDoctorQueue(s.doctorId, s.id);
        queueMap[s.id] = q as QueueEntry[];
      })
    );
    setQueues(queueMap);
    setLoading(false);
  }, [branchId, today]);

  useEffect(() => { void load(); }, [load]);

  async function handleCheckIn(patientId: string, sessionId: string) {
    setCheckingIn(patientId);
    await checkInPatient(patientId, sessionId);
    await load();
    setCheckingIn(null);
  }

  if (loading) return <Skeleton />;

  const calledPatients = sessions.flatMap((s) =>
    (queues[s.id] ?? [])
      .filter((p) => p.status === "waiting")
      .map((p) => ({ ...p, sessionId: s.id, doctorName: s.doctorName }))
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy-mid">
        {calledPatients.length} patient{calledPatients.length !== 1 ? "s" : ""} waiting across active sessions
      </p>

      {calledPatients.length === 0 ? (
        <EmptyState icon="✓" title="All caught up" body="No patients are waiting to be checked in." />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {calledPatients.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-navy">
                  #{p.queueNumber} · {p.name}
                </p>
                <p className="text-xs text-navy-mid">{p.doctorName}</p>
              </div>
              <button
                onClick={() => handleCheckIn(p.id, p.sessionId)}
                disabled={checkingIn === p.id}
                className="rounded-md bg-gold px-4 py-2 text-xs font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
              >
                {checkingIn === p.id ? "…" : "Check In"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Session Queue Panel ───────────────────────────────────────────────────────

function SessionQueuePanel({ doctorId, sessionId }: { doctorId: string; sessionId: string }) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [skipping, setSkipping] = useState<string | null>(null);
  const [noShowing, setNoShowing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = await fetchDoctorQueue(doctorId, sessionId);
    setQueue(q as QueueEntry[]);
  }, [doctorId, sessionId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  async function handleSkip(patientId: string) {
    setSkipping(patientId);
    await skipPatient(patientId, doctorId);
    await load();
    setSkipping(null);
  }

  async function handleNoShow(patientId: string) {
    setNoShowing(patientId);
    await markNoShow(patientId, doctorId);
    await load();
    setNoShowing(null);
  }

  const statusColor: Record<string, string> = {
    waiting: "bg-gold-tint text-gold",
    serving: "bg-success/10 text-success",
    done:    "bg-border text-navy-mid",
    skipped: "bg-orange-50 text-orange-600",
    no_show: "bg-danger/10 text-danger",
  };

  if (queue.length === 0) {
    return <p className="text-sm text-navy-mid">Queue is empty.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-mid">
        Live Queue · {queue.length} entries
      </p>
      {queue.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-tint text-xs font-bold text-navy">
              {p.queueNumber}
            </span>
            <div>
              <p className="text-sm font-medium text-navy">{p.name}</p>
              <p className="text-xs text-navy-mid">~{p.estimatedWaitMin} min</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[p.status] ?? ""}`}>
              {p.status.replace("_", " ")}
            </span>
            {p.status === "waiting" && (
              <>
                <button
                  onClick={() => handleSkip(p.id)}
                  disabled={skipping === p.id}
                  className="rounded border border-border px-2 py-1 text-xs text-navy-mid transition hover:border-navy"
                >
                  Skip
                </button>
                <button
                  onClick={() => handleNoShow(p.id)}
                  disabled={noShowing === p.id}
                  className="rounded border border-danger/30 px-2 py-1 text-xs text-danger transition hover:bg-danger/5"
                >
                  No-Show
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2 py-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-offwhite" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-offwhite py-12 text-center">
      <p className="text-4xl">{icon}</p>
      <p className="mt-3 font-heading text-lg font-bold text-navy">{title}</p>
      <p className="mt-1 text-sm text-navy-mid">{body}</p>
    </div>
  );
}
