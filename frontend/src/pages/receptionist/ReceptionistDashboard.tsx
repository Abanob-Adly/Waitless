import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import * as sessionService from "../../services/sessionService";
import { bookWalkIn } from "../../services/appointmentService";
import type { AppointmentType } from "../../services/appointmentService";
import { lookupPatientByPhone } from "../../services/patientService";
import { toE164 } from "../../utils/phone";
import { validatePhone, validateName } from "../../utils/validation";
import { fmt12 } from "../../utils/time";
import type { BackendSession, BackendAppointment, CashSummary } from "../../services/sessionService";

type RecSection = "sessions" | "walkin" | "checkin";

// ── Page ──────────────────────────────────────────────────────────────────────

export function ReceptionistDashboard() {
  const { authUser, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<RecSection | null>(null);

  if (!authUser || authUser.role !== "receptionist") {
    navigate("/login", { replace: true });
    return null;
  }

  const rec = authUser.profile;
  const orgId = rec.orgId;
  const branchId = rec.branchId;
  const initials = (rec.name as string).split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase();

  const sectionTitle: Record<RecSection, string> = {
    sessions: t("Today's Sessions"),
    walkin:   t("Walk-In Booking"),
    checkin:  t("Patient Check-In"),
  };

  function renderSection() {
    switch (activeSection) {
      case "sessions": return <SessionsTab orgId={orgId} branchId={branchId} />;
      case "walkin":   return <WalkInTab orgId={orgId} branchId={branchId} />;
      case "checkin":  return <CheckInTab orgId={orgId} branchId={branchId} />;
      default:         return null;
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex animate-fade-up items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-lg font-bold text-white">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-gold">{t("Reception Portal")}</p>
            <h1 className="font-heading text-3xl font-bold text-navy">
              {t("Reception Desk")}
            </h1>
            <p className="mt-0.5 text-sm text-navy-mid">{rec.name} · {t("Receptionist")}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="shrink-0 rounded-md border border-border px-4 py-2 text-sm text-navy-mid transition hover:border-danger/40 hover:text-danger"
        >
          {t("Sign Out")}
        </button>
      </div>

      {/* Breadcrumb */}
      {activeSection && (
        <div className="mb-5 flex animate-fade-up items-center gap-2 text-sm">
          <button
            onClick={() => setActiveSection(null)}
            className="font-medium text-gold transition hover:text-gold-light"
          >
            {t("Dashboard")}
          </button>
          <span className="text-border">/</span>
          <span className="font-medium text-navy">{sectionTitle[activeSection]}</span>
        </div>
      )}

      <div className="animate-fade-up rounded-xl border border-border bg-white p-6 shadow-sm" style={{ animationDelay: "80ms" }}>
        {activeSection ? (
          renderSection()
        ) : (
          <ReceptionHome onSelect={setActiveSection} />
        )}
      </div>
    </main>
  );
}

// ── Reception Home card grid ──────────────────────────────────────────────────

function ReceptionHome({ onSelect }: { onSelect: (s: RecSection) => void }) {
  const { t } = useLanguage();
  const cards: { id: RecSection; title: string; desc: string; icon: React.ReactNode; theme: "navy" | "gold" | "success" }[] = [
    {
      id: "sessions",
      title: t("Today's Sessions"),
      desc: t("View all active doctor sessions, expand to see patient queue and manage appointments"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 9h14" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 3v4M13 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      theme: "success",
    },
    {
      id: "walkin",
      title: t("Walk-In Booking"),
      desc: t("Register a walk-in patient into an active session without a prior appointment"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="6" r="3" fill="currentColor" />
          <path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 3l2 2-2 2M16 5H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      theme: "gold",
    },
    {
      id: "checkin",
      title: t("Patient Check-In"),
      desc: t("Look up an existing appointment by phone number to confirm arrival at the clinic"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M5 10l3.5 3.5L15 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
      theme: "navy",
    },
  ];

  const themeMap = {
    navy:    { ring: "hover:ring-navy/20",    iconBg: "bg-navy",    arrow: "text-navy"    },
    gold:    { ring: "hover:ring-gold/25",    iconBg: "bg-gold",    arrow: "text-gold"    },
    success: { ring: "hover:ring-success/20", iconBg: "bg-success", arrow: "text-success" },
  };

  return (
    <div className="grid animate-fade-up grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card, i) => {
        const cls = themeMap[card.theme];
        return (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`group flex flex-col gap-4 rounded-xl border border-border bg-white p-5 text-left shadow-sm ring-2 ring-transparent transition hover:shadow-md ${cls.ring}`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${cls.iconBg}`}>
              {card.icon}
            </div>
            <div className="flex-1">
              <p className="font-heading text-base font-bold text-navy">{card.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-navy-mid">{card.desc}</p>
            </div>
            <span className={`text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100 ${cls.arrow}`}>
              {t("Open →")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Today's Sessions Tab ──────────────────────────────────────────────────────

function SessionsTab({ orgId, branchId }: { orgId: string; branchId: string }) {
  const { locale } = useLanguage();
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<{ sessionId: string; waitingCount: number } | null>(null);
  const [extendMinutes, setExtendMinutes] = useState(15);
  const [extending, setExtending] = useState(false);

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

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

  // Don't end a session out from under waiting patients without asking first.
  async function requestClose(sessionId: string) {
    let waitingCount = 0;
    try {
      const q = await sessionService.getQueue(orgId, branchId, sessionId);
      waitingCount = q.appointments.length;
    } catch { /* ignore — treat as empty */ }
    if (waitingCount === 0) {
      void handleClose(sessionId);
      return;
    }
    setExtendMinutes(15);
    setConfirmClose({ sessionId, waitingCount });
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

  async function handleExtend() {
    if (!confirmClose) return;
    setExtending(true);
    try {
      await sessionService.extendSession(orgId, branchId, confirmClose.sessionId, extendMinutes);
      setConfirmClose(null);
    } catch { /* ignore */ }
    setExtending(false);
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
                    {s.date} · {fmt12(s.startTime, locale)} – {fmt12(s.endTime, locale)}
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
                          onClick={() => void requestClose(s.id)}
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
            <p className="font-heading text-xl font-bold text-navy">Patients Still Waiting</p>
            <p className="mt-2 text-sm text-navy-mid">
              {confirmClose.waitingCount} patient{confirmClose.waitingCount !== 1 ? "s are" : " is"} still in the
              queue. Ending now will mark them as no-show. Add more time instead?
            </p>
            <div className="mt-4">
              <span className="text-sm font-medium text-navy">Add minutes</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {[10, 15, 30, 45].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setExtendMinutes(min)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                      extendMinutes === min ? "border-gold bg-gold text-navy" : "border-border text-navy-mid hover:border-gold"
                    }`}
                  >
                    {min} min
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => handleClose(confirmClose.sessionId)}
                disabled={extending}
                className="flex h-10 flex-1 items-center justify-center rounded-md border border-danger/40 text-sm font-medium text-danger transition hover:bg-danger/5 disabled:opacity-50"
              >
                End Anyway
              </button>
              <button
                onClick={() => void handleExtend()}
                disabled={extending}
                className="flex h-10 flex-1 items-center justify-center rounded-md bg-gold text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-50"
              >
                {extending ? "Adding…" : `Add ${extendMinutes} min`}
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
  const { t, locale } = useLanguage();
  const [phase, setPhase] = useState<"lookup" | "booking">("lookup");
  const [foundPatient, setFoundPatient] = useState<{ fullName: string; phone: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [appointmentType, setAppointmentType] = useState<AppointmentType>("new_consultation");
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<{ queueNumber: number; estimatedWaitMin?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const walkinNow = new Date();
  const today = [
    walkinNow.getFullYear(),
    String(walkinNow.getMonth() + 1).padStart(2, "0"),
    String(walkinNow.getDate()).padStart(2, "0"),
  ].join("-");

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
    const ph = validatePhone(phone.trim());
    if (!ph.valid) { setError(ph.error); return; }
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
    if (!selectedSession) { setError(t("Please select an active session.")); return; }
    const nm = validateName(patientName.trim());
    if (!nm.valid) { setError(nm.error); return; }

    setAdding(true);
    setError(null);
    try {
      const appt = await bookWalkIn(orgId, branchId, selectedSession, {
        patientPhone:    phone.trim() ? toE164(phone.trim()) : undefined,
        patientName:     patientName.trim(),
        appointmentType,
      });
      setResult({ queueNumber: appt.queueNumber, estimatedWaitMin: appt.estimatedWaitMin });
      setPatientName("");
      setPhone("");
      setFoundPatient(null);
      setAppointmentType("new_consultation");
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
          <p className="font-medium text-success">{t("Patient added to queue")}</p>
          <p className="mt-1 text-2xl font-bold text-navy">#{result.queueNumber}</p>
          <p className="text-xs text-navy-mid">
            {t("Queue number assigned")}
            {result.estimatedWaitMin != null && result.estimatedWaitMin > 0 && (
              <> · {t("Est. wait:")} <span className="font-semibold">{Math.round(result.estimatedWaitMin)} {t("min")}</span></>
            )}
          </p>
          <button
            onClick={() => setResult(null)}
            className="mt-2 text-xs text-navy-mid hover:text-navy"
          >
            {t("Add another →")}
          </button>
        </div>
      )}

      {phase === "lookup" ? (
        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy">{t("Patient Phone *")}</label>
            <div className="mt-1.5 flex h-11 overflow-hidden rounded-md border border-border bg-white focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20">
              <span className="flex shrink-0 items-center border-r border-border bg-offwhite px-2 text-xs font-medium text-navy-mid">+20</span>
              <input
                type="text"
                placeholder="1XXXXXXXXX"
                value={phone}
                onChange={(e) => { setError(null); setPhone(e.target.value); }}
                inputMode="numeric"
                className="h-full flex-1 bg-transparent px-3 text-sm text-navy outline-none"
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={lookingUp}
            className="h-11 w-full rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
          >
            {lookingUp ? t("Searching…") : t("Find Patient →")}
          </button>
        </form>
      ) : (
        <form onSubmit={handleWalkIn} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-navy-mid">{t("Phone:")} <span className="font-medium text-navy">{phone}</span></p>
            <button type="button" onClick={handleReset} className="text-xs text-navy-mid hover:text-navy">
              ← {t("Change Phone")}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy">
              {t("Patient Name *")}
              {foundPatient && (
                <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  {t("Existing patient")}
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder={t("Full name")}
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy">{t("Visit Type")}</label>
            <select
              value={appointmentType}
              onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
              className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              <option value="new_consultation">{t("New Consultation")}</option>
              <option value="follow_up">{t("Follow-Up")}</option>
              <option value="medical_rep">{t("Medical Rep")}</option>
            </select>
          </div>

          {sessions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-navy">{t("Active Session")}</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.doctorName || t("Doctor")} · {fmt12(s.startTime, locale)}–{fmt12(s.endTime, locale)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {sessions.length === 0 && (
            <div className="rounded-lg border border-border bg-offwhite px-4 py-3 text-sm text-navy-mid">
              {t("No active sessions. Start a session in the \"Today's Sessions\" tab first.")}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={adding || sessions.length === 0}
            className="h-11 w-full rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
          >
            {adding ? t("Adding…") : t("Add to Queue →")}
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

  const checkinNow = new Date();
  const today = [
    checkinNow.getFullYear(),
    String(checkinNow.getMonth() + 1).padStart(2, "0"),
    String(checkinNow.getDate()).padStart(2, "0"),
  ].join("-");

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
  const [pendingConfirmation, setPendingConfirmation] = useState<BackendAppointment[]>([]);
  const [currentlyServing, setCurrentlyServing] = useState(0);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [delayMin, setDelayMin] = useState("0");
  const [savingDelay, setSavingDelay] = useState(false);
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);
  const [loadingCash, setLoadingCash] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = await sessionService.getQueue(orgId, branchId, sessionId);
      setQueue(q.appointments);
      setPendingConfirmation(q.pendingConfirmation);
      setCurrentlyServing(q.currentlyServing);
    } catch {
      // Leave stale queue on transient errors to avoid flicker
    }
  }, [orgId, branchId, sessionId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => { void load(); }, 5000);
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

  async function handleSkip(apptId: string) {
    setActionInProgress(apptId);
    try {
      await sessionService.skipToNext(orgId, branchId, sessionId, apptId);
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

  async function handleForceInsert(apptId: string) {
    setActionInProgress(apptId);
    try {
      await sessionService.forceInsertNext(orgId, branchId, sessionId, apptId);
      await load();
    } catch { /* ignore */ }
    setActionInProgress(null);
  }

  async function handleLoadCashSummary() {
    setLoadingCash(true);
    try {
      const summary = await sessionService.getCashSummary(orgId, branchId, sessionId);
      setCashSummary(summary);
    } catch { setCashSummary(null); }
    setLoadingCash(false);
  }

  async function handleConfirmPayment(apptId: string) {
    setActionInProgress(apptId);
    try {
      await sessionService.confirmCashPayment(orgId, branchId, sessionId, apptId);
      await load();
    } catch { /* ignore */ }
    setActionInProgress(null);
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

  return (
    <div className="space-y-4">
      {pendingConfirmation.length > 0 && (
        <div className="space-y-2 rounded-lg border border-gold/30 bg-gold-tint/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-mid">
            🏥 Pending Clinic Payments · {pendingConfirmation.length}
          </p>
          {pendingConfirmation.map((p) => (
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
              <button
                onClick={() => handleConfirmPayment(p.id)}
                disabled={actionInProgress === p.id}
                className="rounded border border-success/40 bg-success/5 px-2.5 py-1 text-xs font-medium text-success transition hover:bg-success/10 disabled:opacity-60"
                title="Confirm payment and add to the live queue"
              >
                {actionInProgress === p.id ? "…" : "✓ Confirm & Add to Queue"}
              </button>
            </div>
          ))}
        </div>
      )}

      {queue.length === 0 ? (
        <p className="text-sm text-navy-mid">Queue is empty.</p>
      ) : (
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
      {queue.map((p) => {
        const isOverdue = p.status === "booked" && currentlyServing > 0 && p.queueNumber < currentlyServing;
        return (
        <div key={p.id} className={`flex items-center justify-between rounded-lg px-4 py-2.5 shadow-sm ${isOverdue ? "border border-danger/20 bg-danger/5" : "bg-white"}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-navy ${isOverdue ? "bg-danger/15" : "bg-gold-tint"}`}>
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
            {isOverdue && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                ⚠ Overdue
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[p.status] ?? ""}`}>
              {p.status.replace("_", " ")}
            </span>
            {p.paymentMethod === "clinic" && p.paymentStatus !== "success" && (
              <button
                onClick={() => handleConfirmPayment(p.id)}
                disabled={actionInProgress === p.id}
                className="rounded border border-success/40 bg-success/5 px-2 py-1 text-xs font-medium text-success transition hover:bg-success/10 disabled:opacity-60"
                title="Mark clinic cash payment as received"
              >
                💵 Confirm Payment
              </button>
            )}
            {p.status === "booked" && (
              <>
                <button
                  onClick={() => handleForceInsert(p.id)}
                  disabled={actionInProgress === p.id}
                  className="rounded border border-gold/50 px-2 py-1 text-xs text-gold transition hover:bg-gold-tint"
                  title="Move to front of queue"
                >
                  Force Next
                </button>
                <button
                  onClick={() => handleSkip(p.id)}
                  disabled={actionInProgress === p.id}
                  className="rounded border border-border px-2 py-1 text-xs text-navy-mid transition hover:border-navy"
                  title="Switch turns with the next patient"
                >
                  Skip
                </button>
                <button
                  onClick={() => handleAction(p.id, "cancelled")}
                  disabled={actionInProgress === p.id}
                  className="rounded border border-border px-2 py-1 text-xs text-navy-mid transition hover:border-navy"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleHold(p.id)}
                  disabled={actionInProgress === p.id}
                  className="rounded border border-danger/30 px-2 py-1 text-xs text-danger transition hover:bg-danger/5"
                  title="Hold their spot — can be re-inserted later"
                >
                  No-Show
                </button>
              </>
            )}
            {p.status === "called" && (
              <>
                <button
                  onClick={() => handleSkip(p.id)}
                  disabled={actionInProgress === p.id}
                  className="rounded border border-border px-2 py-1 text-xs text-navy-mid transition hover:border-navy"
                  title="Switch turns with the next patient"
                >
                  Skip
                </button>
                <button
                  onClick={() => handleHold(p.id)}
                  disabled={actionInProgress === p.id}
                  className="rounded border border-orange-300 px-2 py-1 text-xs text-orange-600 transition hover:bg-orange-50"
                >
                  Hold
                </button>
              </>
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
        );
      })}

      {/* End-of-shift cash drawer reconciliation */}
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xs font-semibold uppercase tracking-wide text-navy-mid">
            Cash Drawer Summary
          </p>
          <button
            onClick={handleLoadCashSummary}
            disabled={loadingCash}
            className="rounded border border-border px-3 py-1 text-xs text-navy-mid transition hover:border-gold hover:text-gold disabled:opacity-60"
          >
            {loadingCash ? "Loading…" : "Refresh"}
          </button>
        </div>

        {cashSummary ? (
          cashSummary.count === 0 ? (
            <p className="mt-2 text-xs text-navy-mid">No cash payments recorded for this session.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {cashSummary.appointments.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-white px-3 py-1.5 text-xs">
                  <span className="text-navy-mid">
                    #{a.queueNumber} · {a.patientName || "Patient"}
                    {a.paymentMethod === "clinic" && <span className="ml-1 rounded bg-gold-tint px-1 text-[10px] text-gold">Clinic</span>}
                  </span>
                  <span className="font-medium text-navy">{a.paidAmount ?? cashSummary.feePerAppointment} EGP</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg bg-gold-tint px-3 py-2 text-sm font-semibold text-navy">
                <span>Total Cash Collected</span>
                <span>{cashSummary.totalCash} EGP</span>
              </div>
            </div>
          )
        ) : (
          <p className="mt-2 text-xs text-navy-mid">Click Refresh to see today's cash totals.</p>
        )}
      </div>
      </div>
      )}
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
