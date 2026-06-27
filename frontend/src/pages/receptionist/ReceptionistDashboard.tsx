import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";
import { Tabs } from "../../components/ui/Tabs";
import * as sessionService from "../../services/sessionService";
import { bookWalkIn } from "../../services/appointmentService";
import { lookupPatientByPhone } from "../../services/patientService";
import { toE164 } from "../../utils/phone";
import type { BackendSession, BackendAppointment } from "../../services/sessionService";

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
  const orgId = rec.orgId;
  const branchId = rec.branchId;

  const tabs = [
    { id: "sessions", label: "Today's Sessions", content: <SessionsTab orgId={orgId} branchId={branchId} /> },
    { id: "walkin",   label: "Walk-In",           content: <WalkInTab orgId={orgId} branchId={branchId} /> },
    { id: "checkin",  label: "Check-In",           content: <CheckInTab orgId={orgId} branchId={branchId} /> },
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

function SessionsTab({ orgId, branchId }: { orgId: string; branchId: string }) {
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    if (!orgId || !branchId) return;
    try {
      const result = await sessionService.getSessions(orgId, branchId, { date: today });
      setSessions(result);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, branchId, today]);

  useEffect(() => { void load(); }, [load]);

  async function handleStart(sessionId: string) {
    try {
      await sessionService.startSession(orgId, branchId, sessionId);
      await load();
    } catch {
      // ignore
    }
  }

  async function handleClose(sessionId: string) {
    try {
      await sessionService.endSession(orgId, branchId, sessionId);
    } catch {
      // ignore
    }
    setConfirmClose(null);
    await load();
  }

  if (loading) return <Skeleton />;

  const statusBadge: Record<string, string> = {
    scheduled: "bg-gold-tint text-gold",
    active:    "bg-success/10 text-success",
    ended:     "bg-border text-navy-mid",
    cancelled: "bg-danger/10 text-danger",
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
                  <p className="font-medium text-navy">
                    {s.doctorName || "Doctor"}
                  </p>
                  {s.specialty && (
                    <p className="text-sm text-navy-mid">{s.specialty}</p>
                  )}
                  <p className="text-xs text-navy-mid">
                    {s.date} · {s.startTime} – {s.endTime}
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
                  <SessionQueuePanel orgId={orgId} branchId={branchId} sessionId={s.id} />
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

function WalkInTab({ orgId, branchId }: { orgId: string; branchId: string }) {
  const [phase, setPhase] = useState<"lookup" | "booking">("lookup");
  const [foundPatient, setFoundPatient] = useState<{ fullName: string; phone: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<{ queueNumber: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!orgId || !branchId) return;
    sessionService.getSessions(orgId, branchId, { date: today }).then((s) => {
      const active = s.filter((x) => x.status === "active");
      setSessions(active);
      if (active.length > 0) setSelectedSession(active[0].id);
    }).catch(() => setSessions([]));
  }, [orgId, branchId, today]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setError("Phone number is required."); return; }
    setLookingUp(true);
    setError(null);
    const patient = await lookupPatientByPhone(orgId, toE164(phone.trim()));
    setLookingUp(false);
    if (patient) {
      setFoundPatient({ fullName: patient.fullName, phone: patient.phone });
      setPatientName(patient.fullName);
    } else {
      setFoundPatient(null);
      setPatientName("");
    }
    setPhase("booking");
  }

  async function handleWalkIn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSession) { setError("Please select an active session."); return; }
    if (!patientName.trim()) { setError("Patient name is required."); return; }

    setAdding(true);
    setError(null);
    try {
      const appt = await bookWalkIn(orgId, branchId, selectedSession, {
        patientPhone: phone.trim() ? toE164(phone.trim()) : undefined,
        patientName: patientName.trim(),
      });
      setResult({ queueNumber: appt.queueNumber });
      setPatientName("");
      setPhone("");
      setFoundPatient(null);
      setPhase("lookup");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to add patient to queue.";
      setError(msg);
    } finally {
      setAdding(false);
    }
  }

  function handleReset() {
    setPhase("lookup");
    setFoundPatient(null);
    setPatientName("");
    setError(null);
  }

  return (
    <div className="space-y-5">
      {result && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-5 py-4">
          <p className="font-medium text-success">Patient added to queue</p>
          <p className="mt-1 text-2xl font-bold text-navy">#{result.queueNumber}</p>
          <p className="text-xs text-navy-mid">Queue number assigned</p>
          <button
            onClick={() => setResult(null)}
            className="mt-2 text-xs text-navy-mid hover:text-navy"
          >
            Add another →
          </button>
        </div>
      )}

      {phase === "lookup" ? (
        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy">Patient Phone *</label>
            <input
              type="text"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={lookingUp}
            className="h-11 w-full rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
          >
            {lookingUp ? "Searching…" : "Find Patient →"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleWalkIn} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-navy-mid">Phone: <span className="font-medium text-navy">{phone}</span></p>
            <button type="button" onClick={handleReset} className="text-xs text-navy-mid hover:text-navy">
              ← Change Phone
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy">
              Patient Name *
              {foundPatient && (
                <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  Existing patient
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder="Full name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>

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
                    {s.doctorName || "Doctor"} · {s.startTime}–{s.endTime}
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

          <button
            type="submit"
            disabled={adding || sessions.length === 0}
            className="h-11 w-full rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
          >
            {adding ? "Adding…" : "Add to Queue →"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Check-In Tab ──────────────────────────────────────────────────────────────

function CheckInTab({ orgId, branchId }: { orgId: string; branchId: string }) {
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [queues, setQueues] = useState<Record<string, BackendAppointment[]>>({});

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    if (!orgId || !branchId) return;
    setLoading(true);
    try {
      const all = await sessionService.getSessions(orgId, branchId, { date: today });
      const active = all.filter((s) => s.status === "active");
      setSessions(active);

      const queueMap: Record<string, BackendAppointment[]> = {};
      await Promise.all(
        active.map(async (s) => {
          const q = await sessionService.getQueue(orgId, branchId, s.id);
          queueMap[s.id] = q.appointments.filter((a) => a.status === "booked");
        })
      );
      setQueues(queueMap);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, branchId, today]);

  useEffect(() => { void load(); }, [load]);

  async function handleCheckIn(apptId: string, sessionId: string) {
    setCheckingIn(apptId);
    try {
      await sessionService.updateAppointmentStatus(orgId, branchId, sessionId, apptId, "called");
      await load();
    } catch {
      // ignore
    }
    setCheckingIn(null);
  }

  if (loading) return <Skeleton />;

  const calledPatients = sessions.flatMap((s) =>
    (queues[s.id] ?? []).map((p) => ({
      ...p,
      sessionId: s.id,
      doctorName: s.doctorName || "Doctor",
    }))
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
                  #{p.queueNumber} · {p.patientProfile.fullName || "Patient"}
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

function SessionQueuePanel({ orgId, branchId, sessionId }: { orgId: string; branchId: string; sessionId: string }) {
  const [queue, setQueue] = useState<BackendAppointment[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [delayMin, setDelayMin] = useState("0");
  const [savingDelay, setSavingDelay] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = await sessionService.getQueue(orgId, branchId, sessionId);
      setQueue(q.appointments);
    } catch {
      setQueue([]);
    }
  }, [orgId, branchId, sessionId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => { void load(); }, 3000);
    return () => window.clearInterval(id);
  }, [load]);

  async function handleAction(apptId: string, status: string) {
    setActionInProgress(apptId);
    try {
      await sessionService.updateAppointmentStatus(orgId, branchId, sessionId, apptId, status);
      await load();
    } catch {
      // ignore
    }
    setActionInProgress(null);
  }

  async function handleHold(apptId: string) {
    setActionInProgress(apptId);
    try {
      await sessionService.holdPatient(orgId, branchId, sessionId, apptId);
      await load();
    } catch { /* ignore */ }
    setActionInProgress(null);
  }

  async function handleReinsert(apptId: string) {
    setActionInProgress(apptId);
    try {
      await sessionService.reinsertPatient(orgId, branchId, sessionId, apptId);
      await load();
    } catch { /* ignore */ }
    setActionInProgress(null);
  }

  async function handleUpdateDelay() {
    setSavingDelay(true);
    try {
      await sessionService.updateSessionDelay(orgId, branchId, sessionId, Number(delayMin));
    } catch { /* ignore */ }
    setSavingDelay(false);
  }

  const statusColor: Record<string, string> = {
    booked:      "bg-gold-tint text-gold",
    called:      "bg-success/10 text-success",
    held:        "bg-orange-50 text-orange-600",
    in_progress: "bg-success/20 text-success",
    completed:   "bg-border text-navy-mid",
    no_show:     "bg-danger/10 text-danger",
    cancelled:   "bg-danger/10 text-danger",
  };

  if (queue.length === 0) {
    return <p className="text-sm text-navy-mid">Queue is empty.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-semibold uppercase tracking-wide text-navy-mid">
          Live Queue · {queue.length} entries
        </p>
        <label className="text-xs text-navy-mid">Global Delay (min):</label>
        <input
          type="number"
          min="0"
          value={delayMin}
          onChange={(e) => setDelayMin(e.target.value)}
          className="h-7 w-16 rounded border border-border px-2 text-xs text-navy outline-none focus:border-gold"
        />
        <button
          onClick={handleUpdateDelay}
          disabled={savingDelay}
          className="rounded border border-gold px-2 py-1 text-xs text-gold transition hover:bg-gold-tint"
        >
          {savingDelay ? "…" : "Update"}
        </button>
      </div>
      {queue.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-tint text-xs font-bold text-navy">
              {p.queueNumber}
            </span>
            <div>
              <p className="text-sm font-medium text-navy">
                {p.patientProfile.fullName || "Patient"}
              </p>
              {p.patientProfile.phone && (
                <p className="text-xs text-navy-mid">{p.patientProfile.phone}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[p.status] ?? ""}`}>
              {p.status.replace("_", " ")}
            </span>
            {p.status === "booked" && (
              <>
                <button
                  onClick={() => handleAction(p.id, "cancelled")}
                  disabled={actionInProgress === p.id}
                  className="rounded border border-border px-2 py-1 text-xs text-navy-mid transition hover:border-navy"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(p.id, "no_show")}
                  disabled={actionInProgress === p.id}
                  className="rounded border border-danger/30 px-2 py-1 text-xs text-danger transition hover:bg-danger/5"
                >
                  No-Show
                </button>
              </>
            )}
            {p.status === "called" && (
              <button
                onClick={() => handleHold(p.id)}
                disabled={actionInProgress === p.id}
                className="rounded border border-orange-300 px-2 py-1 text-xs text-orange-600 transition hover:bg-orange-50"
              >
                Hold
              </button>
            )}
            {p.status === "held" && (
              <button
                onClick={() => handleReinsert(p.id)}
                disabled={actionInProgress === p.id}
                className="rounded border border-success/30 px-2 py-1 text-xs text-success transition hover:bg-success/5"
              >
                Re-Insert
              </button>
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
