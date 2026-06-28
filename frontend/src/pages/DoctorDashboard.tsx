import { useState, useEffect } from "react";
import { usePolling } from "../hooks/usePolling";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import { Tabs } from "../components/ui/Tabs";
import * as sessionService from "../services/sessionService";
import * as appointmentService from "../services/appointmentService";
import { useDoctorActiveSession } from "../hooks/useDoctorActiveSession";
import type { BackendSession, BackendAppointment } from "../services/sessionService";

// ── Page ──────────────────────────────────────────────────────────────────────

export function DoctorDashboard() {
  const { authUser, logout } = useAuth();
  const navigate = useNavigate();

  if (!authUser || authUser.role !== "doctor") {
    navigate("/login", { replace: true });
    return null;
  }

  const doctor = authUser.profile;
  const orgId = doctor.orgId;

  const tabs = [
    {
      id: "queue",
      label: "Today's Queue",
      content: <QueueTab orgId={orgId} doctorAccountId={doctor.id} />,
    },
    {
      id: "manage",
      label: "Manage Queue",
      content: <ManageQueueTab orgId={orgId} doctorAccountId={doctor.id} />,
    },
    {
      id: "sessions",
      label: "My Sessions",
      content: <SessionsTab orgId={orgId} doctorAccountId={doctor.id} />,
    },
    {
      id: "profile",
      label: "My Profile",
      content: <ProfileTab doctorAccountId={doctor.id} doctorName={doctor.name} />,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex animate-fade-up items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gold">Doctor Portal</p>
          <h1 className="font-heading text-4xl font-bold text-navy">
            Welcome, {doctor.name}
          </h1>
          <p className="mt-1 text-sm text-navy-mid">
            {doctor.specialty || "Physician"} · {orgId ? "Clinic Portal" : "No clinic assigned"}
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
        <Tabs items={tabs} defaultTab="queue" />
      </section>
    </main>
  );
}

// ── Today's Queue tab ─────────────────────────────────────────────────────────

function QueueTab({ orgId, doctorAccountId }: { orgId: string; doctorAccountId: string }) {
  const { branches, memberships } = useOrg();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const myMembershipId = memberships.find((m) => m.userId === doctorAccountId)?.id ?? "";
  const { activeSession, activeBranchId, queue, isLoading, reload: load } =
    useDoctorActiveSession(orgId, branches, myMembershipId, doctorAccountId);

  usePolling(() => { void load(); }, 4000);

  async function handleAction(apptId: string, status: string) {
    if (!activeBranchId || !activeSession) return;
    setActionInProgress(apptId);
    try {
      await sessionService.updateAppointmentStatus(orgId, activeBranchId, activeSession.id, apptId, status);
      await load();
    } catch {
      // ignore
    }
    setActionInProgress(null);
  }

  async function handleCallNext() {
    if (!activeBranchId || !activeSession) return;
    try {
      await sessionService.callNext(orgId, activeBranchId, activeSession.id);
      await load();
    } catch {
      // ignore
    }
  }

  const serving = queue.find((p) => p.status === "called" || p.status === "in_progress");
  const waitingCount = queue.filter((p) => p.status === "booked").length;
  const doneCount = queue.filter((p) => p.status === "completed").length;

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-offwhite" />
        ))}
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="rounded-xl bg-offwhite py-12 text-center">
        <p className="text-4xl">📋</p>
        <p className="mt-3 font-heading text-lg font-bold text-navy">No active session today</p>
        <p className="mt-1 text-sm text-navy-mid">
          Ask the receptionist to start your session or check the Sessions tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          <StatBox key="total" label="Total Patients" value={queue.length.toString()} />,
          <StatBox key="waiting" label="Waiting" value={waitingCount.toString()} accent />,
          <StatBox key="done" label="Completed" value={doneCount.toString()} success />,
        ].map((box, i) => (
          <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            {box}
          </div>
        ))}
      </div>

      {serving && (
        <div className="flex items-center justify-between rounded-xl border border-gold bg-gold-tint px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">Now Serving</p>
            <p className="mt-0.5 font-heading text-xl font-bold text-navy">
              #{serving.queueNumber} — {serving.patientProfile.fullName || "Patient"}
            </p>
            <p className="text-xs text-navy-mid">{serving.patientProfile.phone}</p>
          </div>
          {serving.status === "called" && (
            <button
              onClick={() => handleAction(serving.id, "in_progress")}
              disabled={actionInProgress === serving.id}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-mid disabled:opacity-60"
            >
              Start Consultation →
            </button>
          )}
          {serving.status === "in_progress" && (
            <button
              onClick={() => handleAction(serving.id, "completed")}
              disabled={actionInProgress === serving.id}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-mid disabled:opacity-60"
            >
              Mark Complete ✓
            </button>
          )}
        </div>
      )}

      {waitingCount > 0 && !serving && (
        <button
          onClick={handleCallNext}
          className="h-12 w-full rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
        >
          Call Next Patient →
        </button>
      )}

      {queue.length === 0 ? (
        <div className="rounded-xl bg-offwhite py-8 text-center">
          <p className="text-3xl">👥</p>
          <p className="mt-2 text-sm text-navy-mid">Queue is empty</p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {queue.map((appt) => (
            <QueueRow
              key={appt.id}
              appt={appt}
              onSkip={() => handleAction(appt.id, "skipped")}
              onNoShow={() => handleAction(appt.id, "no_show")}
              actionInProgress={actionInProgress === appt.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sessions tab ──────────────────────────────────────────────────────────────

function SessionsTab({ orgId, doctorAccountId }: { orgId: string; doctorAccountId: string }) {
  const { branches, memberships } = useOrg();
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const myMembershipId = memberships.find((m) => m.userId === doctorAccountId)?.id ?? "";

  useEffect(() => {
    if (!orgId || branches.length === 0) return;
    const d = new Date();
    const today = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");

    Promise.all(
      branches.map((b) => sessionService.getSessions(orgId, b.id, { date: today }))
    )
      .then((perBranch) => {
        const all = perBranch.flat().filter(
          (s) => s.doctorId === myMembershipId || s.doctorId === doctorAccountId,
        );
        setSessions(all);
      })
      .catch(() => setSessions([]))
      .finally(() => setIsLoading(false));
  }, [orgId, branches, myMembershipId, doctorAccountId]);

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-offwhite" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl bg-offwhite py-12 text-center">
        <p className="text-4xl">📅</p>
        <p className="mt-3 font-heading text-lg font-bold text-navy">No sessions scheduled today</p>
        <p className="mt-1 text-sm text-navy-mid">
          Contact your clinic administrator to schedule sessions.
        </p>
      </div>
    );
  }

  const statusBadge: Record<string, string> = {
    scheduled: "bg-gold-tint text-gold",
    active:    "bg-success/10 text-success",
    ended:     "bg-border text-navy-mid",
    cancelled: "bg-danger/10 text-danger",
  };

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {sessions.map((session) => (
        <div key={session.id} className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="font-medium text-navy">{session.date}</p>
            <p className="mt-0.5 text-sm text-navy-mid">
              {session.startTime} – {session.endTime}
            </p>
            <p className="text-xs text-navy-mid">{session.bookingsCount} booked</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge[session.status] ?? ""}`}>
            {session.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QueueRow({
  appt,
  onSkip,
  onNoShow,
  actionInProgress,
}: {
  appt: BackendAppointment;
  onSkip: () => void;
  onNoShow: () => void;
  actionInProgress: boolean;
}) {
  const statusStyles: Record<string, string> = {
    booked:      "bg-gold-tint text-navy",
    called:      "bg-success/10 text-success",
    in_progress: "bg-success/20 text-success",
    completed:   "bg-border/50 text-navy-mid",
    no_show:     "bg-danger/10 text-danger",
    skipped:     "bg-orange-50 text-orange-600",
    cancelled:   "bg-border/50 text-navy-mid",
  };
  const statusLabel: Record<string, string> = {
    booked:      "Waiting",
    called:      "Called ↑",
    in_progress: "In Progress",
    completed:   "Done ✓",
    no_show:     "No-Show",
    skipped:     "Skipped ↩",
    cancelled:   "Cancelled",
  };

  const isDone =
    appt.status === "completed" ||
    appt.status === "no_show" ||
    appt.status === "cancelled";

  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${isDone ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-sm font-bold text-white">
          {appt.queueNumber}
        </span>
        <div>
          <p className="text-sm font-medium text-navy">
            {appt.patientProfile.fullName || "Patient"}
          </p>
          {appt.patientProfile.phone && (
            <p className="text-xs text-navy-mid">{appt.patientProfile.phone}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[appt.status] ?? ""}`}>
          {statusLabel[appt.status] ?? appt.status}
        </span>
        {appt.status === "called" && (
          <>
            <button
              onClick={onSkip}
              disabled={actionInProgress}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-navy-mid transition hover:border-navy hover:text-navy disabled:opacity-60"
            >
              Skip
            </button>
            <button
              onClick={onNoShow}
              disabled={actionInProgress}
              className="rounded-md border border-danger/30 px-3 py-1.5 text-xs text-danger transition hover:bg-danger/5 disabled:opacity-60"
            >
              No-Show
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

const INSURANCE_OPTIONS = [
  "Bupa Egypt", "AXA Egypt", "MetLife Egypt", "Allianz Egypt",
  "GIG Insurance", "Solidarity Insurance", "Salama Insurance", "Cash / Self-Pay",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ProfileTab({
  doctorAccountId,
  doctorName,
}: {
  doctorAccountId: string;
  doctorName: string;
}) {
  const { memberships, schedules, branches, updateMember } = useOrg();
  const myMembership = memberships.find((m) => m.userId === doctorAccountId);

  const [form, setForm] = useState({
    bio: "",
    specialties: "",
    avatarUrl: "",
    websiteUrl: "",
    insurances: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Populate form from membership once it loads
  useEffect(() => {
    if (!myMembership) return;
    setForm({
      bio: myMembership.bio ?? "",
      specialties: (myMembership.specialties ?? []).join(", "),
      avatarUrl: "",
      websiteUrl: myMembership.websiteUrl ?? "",
      insurances: myMembership.acceptedInsurances ?? [],
    });
  }, [myMembership?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!myMembership) {
    return (
      <div className="rounded-xl bg-offwhite py-10 text-center">
        <p className="text-sm text-navy-mid">Profile not found — membership may still be loading.</p>
      </div>
    );
  }

  function toggleInsurance(ins: string) {
    setForm((f) => ({
      ...f,
      insurances: f.insurances.includes(ins)
        ? f.insurances.filter((i) => i !== ins)
        : [...f.insurances, ins],
    }));
  }

async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!myMembership) return;
    setSaving(true);
    setResult(null);
    const specialtiesList = form.specialties.split(",").map((s) => s.trim()).filter(Boolean);
    
    const ok = await updateMember(myMembership.id, {
      bio: form.bio.trim() || undefined,
      specialties: specialtiesList.length ? specialtiesList : undefined,
      websiteUrl: form.websiteUrl.trim() || null,
      acceptedInsurances: form.insurances,
    });

    // We don't even need a manual refresh here because your OrgContext does it for us!
    setSaving(false);
    setResult({ ok, msg: ok ? "Profile updated successfully." : "Failed to save. Please try again." });
  }

  const initials = doctorName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  // Read-only schedule: filter org schedules for this doctor
  const mySchedules = schedules.filter((s) => s.doctorId === myMembership.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-offwhite p-4">
        {form.avatarUrl ? (
          <img src={form.avatarUrl} alt={doctorName} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold font-heading text-xl font-bold text-navy">
            {initials}
          </div>
        )}
        <div>
          <p className="font-heading text-lg font-bold text-navy">{doctorName}</p>
          <p className="text-sm text-navy-mid">{myMembership.memberName || "Doctor"}</p>
        </div>
      </div>

      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"}`}>
          {result.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-navy">Bio</span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={3}
            placeholder="A short description about your background and expertise..."
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-navy">Specialties</span>
          <input
            type="text"
            value={form.specialties}
            onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
            placeholder="e.g. Cardiology, Internal Medicine (comma-separated)"
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-navy">Website URL</span>
          <input
            type="url"
            value={form.websiteUrl}
            onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
            placeholder="https://drsmith.com"
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-navy">Avatar URL</span>
          <input
            type="url"
            value={form.avatarUrl}
            onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            placeholder="https://..."
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <div>
          <span className="text-sm font-medium text-navy">Accepted Insurance</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {INSURANCE_OPTIONS.map((ins) => (
              <label key={ins} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-navy-mid transition hover:border-gold/50">
                <input
                  type="checkbox"
                  checked={form.insurances.includes(ins)}
                  onChange={() => toggleInsurance(ins)}
                  className="rounded border-border"
                />
                {ins}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-gold py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>

      {/* Read-only Weekly Schedule + Earnings Breakdown */}
      {mySchedules.length > 0 && (
        <div className="space-y-3 border-t border-border pt-5">
          <div>
            <h3 className="font-heading text-base font-bold text-navy">My Weekly Schedule</h3>
            <p className="mt-0.5 text-xs text-navy-mid">Managed by your clinic administrator.</p>
          </div>
          {mySchedules.map((sched) => {
            const branch = branches.find((b) => b.id === sched.branchId);
            const fee = sched.fee ?? 0;
            const platformCut = Math.round(fee * 0.15);
            const orgCut = Math.round((fee - platformCut) * 0.7);
            const doctorNet = fee - platformCut - orgCut;
            return (
              <div key={sched.id} className="rounded-xl border border-border bg-offwhite p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-navy">{branch?.name ?? "Branch"}</p>
                  <span className="text-sm font-medium text-gold">{sched.fee} EGP / visit</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sched.weeklySlots.map((slot) => (
                    <span
                      key={slot.dayOfWeek}
                      className="rounded-md bg-white px-2.5 py-1 text-xs text-navy-mid border border-border"
                    >
                      {DAY_LABELS[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-navy-mid">{sched.avgConsultationMin} min avg. consultation</p>
                {fee > 0 && (
                  <div className="mt-3 rounded-lg border border-border bg-white px-3 py-2">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-mid">
                      Earnings per Consultation
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-navy-mid">Platform (15%)</p>
                        <p className="font-medium text-navy">−{platformCut} EGP</p>
                      </div>
                      <div>
                        <p className="text-xs text-navy-mid">Clinic (21%)</p>
                        <p className="font-medium text-navy">−{orgCut} EGP</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gold">Your Net</p>
                        <p className="font-bold text-gold">{doctorNet} EGP</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Manage Queue Tab (doctor-as-receptionist fallback) ───────────────────────

function ManageQueueTab({ orgId, doctorAccountId }: { orgId: string; doctorAccountId: string }) {
  const { branches, memberships } = useOrg();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState({ phone: "", name: "" });
  const [walkInMsg, setWalkInMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [walkInLoading, setWalkInLoading] = useState(false);

  const myMembershipId = memberships.find((m) => m.userId === doctorAccountId)?.id ?? "";
  const { activeSession, activeBranchId, queue, isLoading, reload: load } =
    useDoctorActiveSession(orgId, branches, myMembershipId, doctorAccountId);

  useEffect(() => {
    const id = setInterval(() => { void load(); }, 4000);
    return () => clearInterval(id);
  }, [load]);

  async function handleCheckIn(apptId: string) {
    if (!activeBranchId || !activeSession) return;
    setActionInProgress(apptId);
    try {
      await sessionService.updateAppointmentStatus(orgId, activeBranchId, activeSession.id, apptId, "called");
      await load();
    } catch { /* ignore */ }
    setActionInProgress(null);
  }

  async function handleHold(apptId: string) {
    if (!activeBranchId || !activeSession) return;
    setActionInProgress(apptId);
    try {
      await sessionService.holdPatient(orgId, activeBranchId, activeSession.id, apptId);
      await load();
    } catch { /* ignore */ }
    setActionInProgress(null);
  }

  async function handleReinsert(apptId: string) {
    if (!activeBranchId || !activeSession) return;
    setActionInProgress(apptId);
    try {
      await sessionService.reinsertPatient(orgId, activeBranchId, activeSession.id, apptId);
      await load();
    } catch { /* ignore */ }
    setActionInProgress(null);
  }

  async function handleWalkIn(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBranchId || !activeSession || !walkIn.phone.trim() || !walkIn.name.trim()) return;
    setWalkInLoading(true);
    setWalkInMsg(null);
    try {
      const result = await appointmentService.bookWalkIn(orgId, activeBranchId, activeSession.id, {
        patientPhone: walkIn.phone.trim(),
        patientName: walkIn.name.trim(),
      });
      setWalkInMsg({ ok: true, text: `Walk-in added — Queue #${result.queueNumber}` });
      setWalkIn({ phone: "", name: "" });
      await load();
    } catch {
      setWalkInMsg({ ok: false, text: "Failed to add walk-in. Check phone format (+20…)." });
    }
    setWalkInLoading(false);
  }

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-offwhite" />
        ))}
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="rounded-xl bg-offwhite py-12 text-center">
        <p className="text-4xl">🏥</p>
        <p className="mt-3 font-heading text-lg font-bold text-navy">No active session today</p>
        <p className="mt-1 text-sm text-navy-mid">
          Start a session first (via the Sessions tab or ask reception).
        </p>
      </div>
    );
  }

  const booked = queue.filter((a) => a.status === "booked");
  const called = queue.filter((a) => a.status === "called");
  const held   = queue.filter((a) => a.status === "held");

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-xl border border-gold/40 bg-gold-tint px-4 py-3 text-sm text-navy">
        <strong>Receptionist mode</strong> — Use this tab when operating without reception staff.
      </div>

      {/* Check-In Section */}
      <div>
        <h3 className="mb-2 font-heading text-base font-bold text-navy">
          Waiting to Check-In ({booked.length})
        </h3>
        {booked.length === 0 ? (
          <p className="rounded-xl bg-offwhite py-6 text-center text-sm text-navy-mid">
            No patients waiting for check-in
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {booked.map((appt) => (
              <div key={appt.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-xs font-bold text-white">
                    {appt.queueNumber}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-navy">{appt.patientProfile.fullName || "Patient"}</p>
                    <p className="text-xs text-navy-mid">{appt.patientProfile.phone}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCheckIn(appt.id)}
                  disabled={actionInProgress === appt.id}
                  className="rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
                >
                  Check In →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Called / Held Section */}
      {(called.length > 0 || held.length > 0) && (
        <div>
          <h3 className="mb-2 font-heading text-base font-bold text-navy">
            Called &amp; Held ({called.length + held.length})
          </h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {[...called, ...held].map((appt) => (
              <div key={appt.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-xs font-bold text-white">
                    {appt.queueNumber}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-navy">{appt.patientProfile.fullName || "Patient"}</p>
                    <p className="text-xs text-navy-mid">{appt.patientProfile.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${appt.status === "called" ? "bg-success/10 text-success" : "bg-orange-50 text-orange-600"}`}>
                    {appt.status === "called" ? "Called" : "Held"}
                  </span>
                  {appt.status === "called" && (
                    <button
                      onClick={() => handleHold(appt.id)}
                      disabled={actionInProgress === appt.id}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-navy-mid transition hover:border-navy hover:text-navy disabled:opacity-60"
                    >
                      Hold
                    </button>
                  )}
                  {appt.status === "held" && (
                    <button
                      onClick={() => handleReinsert(appt.id)}
                      disabled={actionInProgress === appt.id}
                      className="rounded-md bg-navy px-3 py-1.5 text-xs text-white transition hover:bg-navy-mid disabled:opacity-60"
                    >
                      Re-insert
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Walk-In Form */}
      <div>
        <h3 className="mb-2 font-heading text-base font-bold text-navy">Add Walk-In Patient</h3>
        <form onSubmit={handleWalkIn} className="space-y-3 rounded-xl border border-border bg-offwhite p-4">
          <input
            type="tel"
            value={walkIn.phone}
            onChange={(e) => setWalkIn((w) => ({ ...w, phone: e.target.value }))}
            placeholder="Phone (+201012345678)"
            required
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          <input
            type="text"
            value={walkIn.name}
            onChange={(e) => setWalkIn((w) => ({ ...w, name: e.target.value }))}
            placeholder="Patient full name"
            required
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          {walkInMsg && (
            <p className={`text-xs ${walkInMsg.ok ? "text-success" : "text-danger"}`}>{walkInMsg.text}</p>
          )}
          <button
            type="submit"
            disabled={walkInLoading}
            className="w-full rounded-md bg-navy py-2 text-sm font-medium text-white transition hover:bg-navy-mid disabled:opacity-60"
          >
            {walkInLoading ? "Adding…" : "Add to Queue"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Stat Box ─────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  accent = false,
  success = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  success?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 text-center">
      <p className={`font-heading text-3xl font-bold ${accent ? "text-gold" : success ? "text-success" : "text-navy"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-navy-mid">{label}</p>
    </div>
  );
}
