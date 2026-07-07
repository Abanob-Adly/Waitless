import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePolling } from "../hooks/usePolling";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import { useLanguage } from "../context/LanguageContext";
import * as sessionService from "../services/sessionService";
import * as appointmentService from "../services/appointmentService";
import { useDoctorActiveSession } from "../hooks/useDoctorActiveSession";
import type { BackendSession, BackendAppointment } from "../services/sessionService";
import { WalletView } from "../components/ui/WalletView";
import { SPECIALTIES } from "../data/mockData";
import { fmt12 } from "../utils/time";

type DoctorSection = "workspace" | "calendar" | "wallet" | "profile";

// ── Page ──────────────────────────────────────────────────────────────────────

export function DoctorDashboard() {
  const { authUser, logout } = useAuth();
  const navigate = useNavigate();
  const { myRoles, memberships, isLoading, updateMember } = useOrg();
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<DoctorSection | null>(null);

  if (!authUser || (authUser.role !== "doctor" && authUser.role !== "admin")) {
    navigate("/login", { replace: true });
    return null;
  }

  const profile = authUser.profile as { id: string; name: string; orgId: string; specialty?: string };
  const orgId = profile.orgId;
  const initials = profile.name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  const isAlsoAdmin = myRoles.includes("admin");
  const myMembership = memberships.find((m) => m.userId === profile.id && m.userRole === "doctor")
    ?? memberships.find((m) => m.userId === profile.id);
  const avatarUrl = myMembership?.avatarUrl ?? "";

  // Share doctor avatar with Navbar via localStorage + custom event
  useEffect(() => {
    if (avatarUrl) {
      localStorage.setItem("waitless_avatar_url", avatarUrl);
    } else {
      localStorage.removeItem("waitless_avatar_url");
    }
    window.dispatchEvent(new CustomEvent("waitless:avatarUpdated", { detail: { url: avatarUrl } }));
  }, [avatarUrl]);

  // Specialty backfill modal — shown once when doctor has no specialties set
  const myMembershipForSpecialty = memberships.find(
    (m) => m.userId === profile.id && m.userRole === "doctor",
  );
  const needsSpecialty =
    !isLoading &&
    myMembershipForSpecialty != null &&
    (!myMembershipForSpecialty.specialties || myMembershipForSpecialty.specialties.length === 0);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [specialtySaving, setSpecialtySaving] = useState(false);
  const [specialtyError, setSpecialtyError] = useState<string | null>(null);

  const handleSpecialtyBackfill = useCallback(async () => {
    const cleaned = specialtyInput.trim();
    if (!cleaned) { setSpecialtyError("Please select your specialty."); return; }
    if (!myMembershipForSpecialty) return;
    setSpecialtySaving(true); setSpecialtyError(null);
    const result = await updateMember(myMembershipForSpecialty.id, { specialties: [cleaned] });
    setSpecialtySaving(false);
    if (result !== true) {
      setSpecialtyError(typeof result === "string" ? result : "Failed to save. Please try again.");
    }
    // On success, OrgContext refresh will re-evaluate `needsSpecialty` to false.
  }, [specialtyInput, myMembershipForSpecialty, updateMember]); // eslint-disable-line react-hooks/exhaustive-deps

  const sectionTitle: Record<DoctorSection, string> = {
    workspace: t("Queue & Sessions"),
    calendar: t("Calendar"),
    wallet: t("My Wallet"),
    profile: t("My Profile"),
  };

  function renderSection() {
    switch (activeSection) {
      case "workspace": return <QueueWorkspace orgId={orgId} doctorAccountId={profile.id} />;
      case "calendar": return <CalendarTab orgId={orgId} doctorAccountId={profile.id} />;
      case "wallet":   return <WalletView mode="personal" />;
      case "profile":  return <ProfileTab doctorAccountId={profile.id} doctorName={profile.name} />;
      default:         return null;
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Specialty backfill modal — blocks dashboard until doctor sets a specialty */}
      {needsSpecialty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-navy px-6 py-5">
              <p className="font-heading text-lg font-bold text-white">{t("One quick step")}</p>
              <p className="mt-0.5 text-sm text-white/60">{t("We need your specialty to complete your profile.")}</p>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-navy-mid">
                {t("Your account doesn't have a specialty listed yet. This is required to appear correctly in the system.")}
              </p>
              <div>
                <label className="block text-sm font-medium text-navy">{t("Your Specialty *")}</label>
                <select
                  value={specialtyInput}
                  onChange={(e) => setSpecialtyInput(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="">{t("Select your specialty…")}</option>
                  {SPECIALTIES.filter((s) => s !== "All Specialties").map((s) => (
                    <option key={s} value={s}>{t(s)}</option>
                  ))}
                </select>
                {specialtyError && <p className="mt-1 text-xs text-danger">{t(specialtyError)}</p>}
              </div>
              <button
                onClick={() => void handleSpecialtyBackfill()}
                disabled={specialtySaving}
                className="w-full rounded-md bg-gold py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-60"
              >
                {specialtySaving ? t("Saving…") : t("Save & Continue →")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex animate-fade-up items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile.name}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-lg font-bold text-white">
              {initials}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-gold">{t("Doctor Portal")}</p>
              {isAlsoAdmin && (
                <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
                  {t("+ Admin")}
                </span>
              )}
            </div>
            <h1 className="font-heading text-3xl font-bold text-navy">
              {t("Welcome, Dr.")} {profile.name.split(" ")[0]}
            </h1>
            <p className="mt-0.5 text-sm text-navy-mid">
              {profile.specialty ?? t("Physician")} · {orgId ? t("Clinic Portal") : t("No clinic assigned")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isAlsoAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="rounded-md border border-navy/30 bg-navy/5 px-4 py-2 text-sm font-medium text-navy transition hover:bg-navy/10"
            >
              {t("Admin View →")}
            </button>
          )}
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="rounded-md border border-border px-4 py-2 text-sm text-navy-mid transition hover:border-danger/40 hover:text-danger"
          >
            {t("Sign Out")}
          </button>
        </div>
      </div>

      {/* Breadcrumb when inside a section */}
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

      {/* Content */}
      <div className="animate-fade-up rounded-xl border border-border bg-white p-6 shadow-sm" style={{ animationDelay: "80ms" }}>
        {activeSection ? (
          renderSection()
        ) : (
          <DoctorHome
            isAlsoAdmin={isAlsoAdmin}
            onSelect={setActiveSection}
            onAdminView={() => navigate("/admin")}
          />
        )}
      </div>
    </main>
  );
}

// ── Doctor Home card grid ─────────────────────────────────────────────────────

function DoctorHome({
  isAlsoAdmin,
  onSelect,
  onAdminView,
}: {
  isAlsoAdmin: boolean;
  onSelect: (s: DoctorSection) => void;
  onAdminView: () => void;
}) {
  const { t } = useLanguage();
  type CardDef = { id: DoctorSection; icon: React.ReactNode; title: string; desc: string; theme: "navy" | "gold" | "success" };

  const cards: CardDef[] = [
    { id: "workspace", icon: <IconQueue />,    title: t("Queue & Sessions"), desc: t("Manage today's queue, start/end sessions, and add walk-ins in one place"), theme: "success" },
    { id: "calendar",  icon: <IconCalendar />, title: t("Calendar"),         desc: t("Monthly schedule view with booked sessions at a glance"),                  theme: "gold"    },
    { id: "wallet",    icon: <IconWallet />,   title: t("My Wallet"),        desc: t("Track your earnings, commissions, and top-up history"),                    theme: "gold"    },
    { id: "profile",   icon: <IconProfile />,  title: t("My Profile"),       desc: t("Update your bio, specialties, and account settings"),                      theme: "navy"    },
  ];

  const themeMap = {
    navy:    { ring: "hover:ring-navy/20",    iconBg: "bg-navy",    arrow: "text-navy"    },
    gold:    { ring: "hover:ring-gold/25",    iconBg: "bg-gold",    arrow: "text-gold"    },
    success: { ring: "hover:ring-success/20", iconBg: "bg-success", arrow: "text-success" },
  };

  return (
    <div className="grid animate-fade-up grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => {
        const cls = themeMap[card.theme];
        return (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            style={{ animationDelay: `${i * 40}ms` }}
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

      {isAlsoAdmin && (
        <button
          onClick={onAdminView}
          className="group flex flex-col gap-4 rounded-xl border border-gold/30 bg-gold-tint p-5 text-left shadow-sm ring-2 ring-transparent transition hover:shadow-md hover:ring-gold/25"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-white">
            <IconAdmin />
          </div>
          <div className="flex-1">
            <p className="font-heading text-base font-bold text-navy">{t("Admin Panel")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-navy-mid">
              {t("Manage your clinic, staff, and schedules")}
            </p>
          </div>
          <span className="text-xs font-semibold text-gold opacity-0 transition-opacity group-hover:opacity-100">
            {t("Switch to Admin →")}
          </span>
        </button>
      )}
    </div>
  );
}

// ── Doctor section icons ──────────────────────────────────────────────────────

function IconQueue() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6" r="3" fill="currentColor" />
      <path d="M4 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3v4M13 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="6" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="13" r="1.5" fill="currentColor" />
      <path d="M5 4h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconProfile() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 17c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconAdmin() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L10 14.4l-4.8 2.4.9-5.3L2.2 7.7l5.4-.8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Unified Queue & Sessions workspace ───────────────────────────────────────

function QueueWorkspace({ orgId, doctorAccountId }: { orgId: string; doctorAccountId: string }) {
  const { branches, memberships } = useOrg();
  const { t, locale } = useLanguage();

  // ── Sessions sidebar state ─────────────────────────────────────────────────
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [endingSession, setEndingSession] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [excuseModal, setExcuseModal] = useState<{ sessionId: string; branchId: string } | null>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const [submittingExcuse, setSubmittingExcuse] = useState(false);
  const [excuseError, setExcuseError] = useState<string | null>(null);

  // ── Queue management state ─────────────────────────────────────────────────
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakDuration, setBreakDuration] = useState(15);
  const [breakPending, setBreakPending] = useState(false);
  const [breakError, setBreakError] = useState<string | null>(null);
  const [breakCooldownSec, setBreakCooldownSec] = useState(0);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkIn, setWalkIn] = useState({ phone: "", name: "" });
  const [walkInMsg, setWalkInMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [walkInLoading, setWalkInLoading] = useState(false);

  type CancelToast = { id: number; name: string };
  const [cancellationLog, setCancellationLog] = useState<CancelToast[]>([]);
  const nextToastId = useRef(0);
  function handleCancellation(patientName: string) {
    const id = ++nextToastId.current;
    setCancellationLog((prev) => [...prev, { id, name: patientName }]);
    setTimeout(() => setCancellationLog((prev) => prev.filter((c) => c.id !== id)), 6000);
  }

  const myMembershipId =
    memberships.find((m) => m.userId === doctorAccountId && m.userRole === "doctor")?.id ??
    memberships.find((m) => m.userId === doctorAccountId)?.id ?? "";

  const { activeSession, activeBranchId, queue, isLoading, reload: load, reloadQueueNow } =
    useDoctorActiveSession(orgId, branches, myMembershipId, doctorAccountId, { onCancellation: handleCancellation });

  // ── Load sessions list ─────────────────────────────────────────────────────
  function loadSessions() {
    if (!orgId || branches.length === 0) return;
    const d = new Date();
    const today = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    Promise.all(branches.map((b) => sessionService.getSessions(orgId, b.id, { date: today })))
      .then((perBranch) => {
        const all = perBranch.flat().filter((s) => s.doctorId === myMembershipId || s.doctorId === doctorAccountId);
        setSessions(all);
      })
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }
  useEffect(() => { loadSessions(); }, [orgId, branches, myMembershipId, doctorAccountId, sessionsRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  usePolling(() => { void loadSessions(); }, 30_000);

  // ── Sync break state from active session ──────────────────────────────────
  useEffect(() => {
    if (!activeSession) return;
    setIsOnBreak(activeSession.isOnBreak);
    if (!activeSession.isOnBreak && activeSession.lastBreakEndedAt) {
      const elapsedSec = (Date.now() - new Date(activeSession.lastBreakEndedAt).getTime()) / 1000;
      setBreakCooldownSec(Math.max(0, Math.ceil(30 * 60 - elapsedSec)));
    } else {
      setBreakCooldownSec(0);
    }
  }, [activeSession]);

  useEffect(() => {
    if (breakCooldownSec <= 0) return;
    const id = setInterval(() => setBreakCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [breakCooldownSec]);

  // ── Queue polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 10_000);
    return () => clearInterval(id);
  }, [load]);

  // ── Queue actions ──────────────────────────────────────────────────────────
  // These use reloadQueueNow (a single targeted fetch of this session's queue)
  // instead of the full load() (which re-scans every branch's session list) so
  // the UI reflects the change immediately rather than waiting on the next
  // 10s poll or requiring a manual page refresh.
  async function handleAction(apptId: string, status: string) {
    if (!activeBranchId || !activeSession) return;
    setActionInProgress(apptId);
    try {
      await sessionService.updateAppointmentStatus(orgId, activeBranchId, activeSession.id, apptId, status);
      await reloadQueueNow();
    } catch { /* ignore */ }
    setActionInProgress(null);
  }
  async function handleCallNext() {
    if (!activeBranchId || !activeSession) return;
    try { await sessionService.callNext(orgId, activeBranchId, activeSession.id); await reloadQueueNow(); } catch { /* ignore */ }
  }
  async function handleHold(apptId: string) {
    if (!activeBranchId || !activeSession) return;
    setActionInProgress(apptId);
    try { await sessionService.holdPatient(orgId, activeBranchId, activeSession.id, apptId); await reloadQueueNow(); } catch { /* ignore */ }
    setActionInProgress(null);
  }
  async function handleReinsert(apptId: string) {
    if (!activeBranchId || !activeSession) return;
    setActionInProgress(apptId);
    try { await sessionService.reinsertPatient(orgId, activeBranchId, activeSession.id, apptId); await reloadQueueNow(); } catch { /* ignore */ }
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
      await reloadQueueNow();
    } catch {
      setWalkInMsg({ ok: false, text: "Failed to add walk-in. Check phone format (+20…)." });
    }
    setWalkInLoading(false);
  }

  // ── Break actions ──────────────────────────────────────────────────────────
  async function handleStartBreak() {
    if (!activeBranchId || !activeSession) return;
    setBreakPending(true); setBreakError(null);
    try {
      await sessionService.startBreak(orgId, activeBranchId, activeSession.id, breakDuration);
      setIsOnBreak(true); setShowBreakModal(false);
    } catch (err) {
      setBreakError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to start break.");
    }
    setBreakPending(false);
  }
  async function handleResumeFromBreak() {
    if (!activeBranchId || !activeSession) return;
    setBreakPending(true); setBreakError(null);
    try {
      await sessionService.resumeFromBreak(orgId, activeBranchId, activeSession.id);
      setIsOnBreak(false); setBreakCooldownSec(30 * 60);
    } catch (err) {
      setBreakError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to resume.");
    }
    setBreakPending(false);
  }

  // ── Session actions ────────────────────────────────────────────────────────
  async function doEndSession(sessionId: string, branchId: string) {
    setEndingSession(sessionId); setSessionActionError(null);
    try {
      await sessionService.endSession(orgId, branchId, sessionId);
      setSessionsRefreshKey((k) => k + 1); await load();
    } catch { setSessionActionError("Failed to end session. Please try again."); }
    setEndingSession(null);
  }
  async function handleSubmitExcuse() {
    if (!excuseModal || !excuseReason.trim()) { setExcuseError("Please enter a reason."); return; }
    setSubmittingExcuse(true); setExcuseError(null);
    try {
      await sessionService.submitExcuse(orgId, excuseModal.branchId, excuseModal.sessionId, excuseReason.trim());
      setExcuseModal(null); setExcuseReason(""); setSessionsRefreshKey((k) => k + 1);
    } catch { setExcuseError("Failed to submit excuse. Please try again."); }
    setSubmittingExcuse(false);
  }

  // ── Derived queue state ────────────────────────────────────────────────────
  const serving = queue.find((p) => p.status === "called" || p.status === "in_progress");
  const waitingCount = queue.filter((p) => p.status === "booked").length;
  const doneCount = queue.filter((p) => p.status === "completed").length;
  const heldCount = queue.filter((p) => p.status === "held").length;

  function isOverdue(s: BackendSession) {
    if (s.status !== "scheduled") return false;
    return new Date(`${s.date}T${s.startTime}:00Z`) < new Date();
  }

  const statusBadge: Record<string, string> = {
    scheduled: "bg-gold-tint text-gold",
    active:    "bg-success/10 text-success",
    ended:     "bg-border text-navy-mid",
    cancelled: "bg-danger/10 text-danger",
  };

  return (
    <div className="flex gap-5">
      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 space-y-5">

        {/* Cancellation toasts */}
        {cancellationLog.length > 0 && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-2">
            {cancellationLog.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl border border-danger/20 bg-white px-4 py-3 shadow-lg">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger/10 text-sm text-danger">✕</span>
                <div>
                  <p className="text-sm font-semibold text-navy">{t("Patient cancelled")}</p>
                  <p className="text-xs text-navy-mid">{c.name} — {t("booking cancelled")}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-offwhite" />)}
          </div>
        )}

        {/* No active session */}
        {!isLoading && !activeSession && (
          <div className="rounded-xl bg-offwhite py-10 text-center">
            <p className="text-4xl">📋</p>
            <p className="mt-3 font-heading text-lg font-bold text-navy">{t("No active session today")}</p>
            <p className="mt-1 text-sm text-navy-mid">{t("Start a session from the sidebar or ask your receptionist.")}</p>
          </div>
        )}

        {/* ── Active session header ──────────────────────────────────────── */}
        {!isLoading && activeSession && (
          <>
            <div className="rounded-xl border border-gold/40 bg-gold-tint px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t("Active Session")}</p>
                  <p className="mt-0.5 font-heading text-base font-bold text-navy">
                    {activeSession.date} · {fmt12(activeSession.startTime, locale)} – {fmt12(activeSession.endTime, locale)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Break / Resume */}
                  {isOnBreak ? (
                    <button
                      onClick={handleResumeFromBreak}
                      disabled={breakPending}
                      className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition hover:bg-navy-mid disabled:opacity-60"
                    >
                      {breakPending ? t("Resuming…") : t("Resume Queue")}
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (breakCooldownSec <= 0) { setBreakError(null); setShowBreakModal(true); } }}
                      disabled={breakCooldownSec > 0}
                      title={breakCooldownSec > 0 ? `${t("Break available in")} ${Math.floor(breakCooldownSec / 60)}:${String(breakCooldownSec % 60).padStart(2, "0")}` : undefined}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-navy-mid transition hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {breakCooldownSec > 0 ? `☕ ${Math.floor(breakCooldownSec / 60)}:${String(breakCooldownSec % 60).padStart(2, "0")}` : t("☕ Break")}
                    </button>
                  )}
                  {/* End session */}
                  <button
                    onClick={() => void doEndSession(activeSession.id, activeBranchId)}
                    disabled={endingSession === activeSession.id}
                    className="rounded-md border border-danger/40 bg-danger/5 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                  >
                    {endingSession === activeSession.id ? t("Ending…") : t("End Session")}
                  </button>
                </div>
              </div>
              {breakError && <p className="mt-2 text-xs text-danger">{breakError}</p>}
              {sessionActionError && <p className="mt-2 text-xs text-danger">{t(sessionActionError)}</p>}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <StatBox label={t("Total")} value={queue.length.toString()} />
              <div className="relative">
                <StatBox label={t("Waiting")} value={waitingCount.toString()} accent />
                {cancellationLog.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {cancellationLog.length}
                  </span>
                )}
              </div>
              <StatBox label={t("Held")} value={heldCount.toString()} />
              <StatBox label={t("Done")} value={doneCount.toString()} success />
            </div>

            {/* Break banner */}
            {isOnBreak && (
              <div className="flex items-center justify-between rounded-xl border border-gold/40 bg-gold-tint px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-navy">{t("You are on a break")}</p>
                  <p className="mt-0.5 text-xs text-navy-mid">{t("Patients have been notified")}</p>
                </div>
              </div>
            )}

            {/* Now Serving */}
            {serving && (
              <div className="flex items-center justify-between rounded-xl border border-gold bg-gold-tint px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t("Now Serving")}</p>
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
                    {t("Start Consultation →")}
                  </button>
                )}
                {serving.status === "in_progress" && (
                  <button
                    onClick={() => handleAction(serving.id, "completed")}
                    disabled={actionInProgress === serving.id}
                    className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-mid disabled:opacity-60"
                  >
                    {t("Mark Complete ✓")}
                  </button>
                )}
              </div>
            )}

            {/* Call Next */}
            {waitingCount > 0 && !serving && (
              <button
                onClick={handleCallNext}
                className="h-12 w-full rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
              >
                {t("Call Next Patient →")}
              </button>
            )}

            {/* Queue list */}
            {queue.length === 0 ? (
              <div className="rounded-xl bg-offwhite py-8 text-center">
                <p className="text-3xl">👥</p>
                <p className="mt-2 text-sm text-navy-mid">{t("Queue is empty")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {queue.map((appt) => {
                  const canHold    = appt.status === "called";
                  const canInsert  = appt.status === "held";
                  const canSkip    = appt.status === "booked";
                  const canNoShow  = appt.status === "booked" || appt.status === "held";
                  return (
                    <div key={appt.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-xs font-bold text-white">
                          {appt.queueNumber}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-navy">{appt.patientProfile.fullName || "Patient"}</p>
                          <p className="text-xs text-navy-mid">{appt.patientProfile.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          appt.status === "booked"      ? "bg-offwhite text-navy-mid"
                          : appt.status === "called"    ? "bg-success/10 text-success"
                          : appt.status === "in_progress" ? "bg-gold-tint text-gold"
                          : appt.status === "held"      ? "bg-orange-50 text-orange-600"
                          : appt.status === "completed" ? "bg-success/5 text-success"
                          : "bg-danger/10 text-danger"
                        }`}>
                          {t(appt.status)}
                        </span>
                        {canHold && (
                          <button
                            onClick={() => handleHold(appt.id)}
                            disabled={actionInProgress === appt.id}
                            className="rounded-md border border-border px-2.5 py-1 text-xs text-navy-mid transition hover:border-navy disabled:opacity-60"
                          >
                            {t("Hold")}
                          </button>
                        )}
                        {canInsert && (
                          <button
                            onClick={() => handleReinsert(appt.id)}
                            disabled={actionInProgress === appt.id}
                            className="rounded-md bg-navy px-2.5 py-1 text-xs text-white transition hover:bg-navy-mid disabled:opacity-60"
                          >
                            {t("Re-insert")}
                          </button>
                        )}
                        {canSkip && (
                          <button
                            onClick={() => handleAction(appt.id, "skipped")}
                            disabled={actionInProgress === appt.id}
                            className="rounded-md border border-border px-2.5 py-1 text-xs text-navy-mid transition hover:border-danger hover:text-danger disabled:opacity-60"
                          >
                            {t("Skip")}
                          </button>
                        )}
                        {canNoShow && (
                          <button
                            onClick={() => handleAction(appt.id, "no_show")}
                            disabled={actionInProgress === appt.id}
                            className="rounded-md border border-danger/30 px-2.5 py-1 text-xs text-danger transition hover:bg-danger/5 disabled:opacity-60"
                          >
                            {t("No-show")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Walk-in form (collapsible) */}
            <div>
              <button
                onClick={() => setShowWalkIn((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-offwhite px-4 py-2.5 text-sm font-medium text-navy transition hover:border-navy"
              >
                <span>{t("+ Add Walk-In Patient")}</span>
                <span className="text-navy-mid">{showWalkIn ? "▲" : "▼"}</span>
              </button>
              {showWalkIn && (
                <form onSubmit={handleWalkIn} className="mt-2 space-y-3 rounded-xl border border-border bg-offwhite p-4">
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
                    placeholder={t("Patient full name")}
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
                    {walkInLoading ? t("Adding…") : t("Add to Queue")}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Sessions sidebar ──────────────────────────────────────────────── */}
      <div className="w-64 shrink-0">
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-t-xl px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold text-navy">{t("Today's Sessions")}</p>
            <span className="text-xs text-navy-mid">{sidebarOpen ? "▲" : "▼"}</span>
          </button>

          {sidebarOpen && (
            <div className="divide-y divide-border border-t border-border">
              {sessionsLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-offwhite" />)}
                </div>
              ) : sessions.length === 0 ? (
                <p className="px-4 py-4 text-xs text-navy-mid">{t("No sessions today")}</p>
              ) : (
                sessions.map((s) => {
                  const overdue = isOverdue(s);
                  return (
                    <div key={s.id} className={`px-4 py-3 ${overdue ? "bg-danger/3" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-navy">
                            {fmt12(s.startTime, locale)} – {fmt12(s.endTime, locale)}
                          </p>
                          <p className="text-xs text-navy-mid">{s.bookingsCount} {t("booked")}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[s.status] ?? ""}`}>
                          {t(s.status)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {s.status === "active" && s.id !== activeSession?.id && (
                          <button
                            onClick={() => void doEndSession(s.id, s.branchId)}
                            disabled={endingSession === s.id}
                            className="rounded border border-danger/40 bg-danger/5 px-2 py-0.5 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                          >
                            {endingSession === s.id ? t("Ending…") : t("End")}
                          </button>
                        )}
                        {overdue && !s.excuse?.submittedAt && (
                          <button
                            onClick={() => setExcuseModal({ sessionId: s.id, branchId: s.branchId })}
                            className="rounded border border-danger/40 bg-danger/5 px-2 py-0.5 text-xs font-medium text-danger transition hover:bg-danger/10"
                          >
                            {t("Excuse")}
                          </button>
                        )}
                      </div>
                      {s.penaltyApplied && (
                        <p className="mt-1 text-xs text-danger">
                          {t("Penalty")}: {s.penaltyApplied.amount} EGP
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Break modal ───────────────────────────────────────────────────── */}
      {showBreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setShowBreakModal(false)} />
          <div className="relative w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-navy px-6 py-4">
              <p className="font-heading text-base font-bold text-white">{t("Take a Break")}</p>
              <p className="mt-0.5 text-xs text-white/50">{t("Queue will pause and patients will be notified")}</p>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <p className="mb-2 text-sm font-medium text-navy">{t("Break duration")}</p>
                <div className="flex gap-2">
                  {[10, 15, 30].map((min) => (
                    <button
                      key={min}
                      onClick={() => setBreakDuration(min)}
                      className={`flex-1 rounded-md border py-2 text-sm font-medium transition ${
                        breakDuration === min ? "border-gold bg-gold-tint text-navy" : "border-border text-navy-mid hover:border-navy hover:text-navy"
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                </div>
              </div>
              {breakError && <p className="text-xs text-danger">{breakError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowBreakModal(false); setBreakError(null); }}
                  className="flex-1 rounded-md border border-border py-2.5 text-sm text-navy-mid hover:border-navy hover:text-navy"
                >
                  {t("Cancel")}
                </button>
                <button
                  onClick={handleStartBreak}
                  disabled={breakPending}
                  className="flex-1 rounded-md bg-gold py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-50"
                >
                  {breakPending ? t("Starting…") : t("Start Break")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Excuse submission modal ───────────────────────────────────────── */}
      {excuseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => { setExcuseModal(null); setExcuseReason(""); }} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-navy px-6 py-4">
              <p className="font-heading text-base font-bold text-white">{t("Submit Late-Start Excuse")}</p>
              <p className="mt-0.5 text-xs text-white/50">{t("Explain why your session started late")}</p>
            </div>
            <div className="space-y-4 p-5">
              <textarea
                value={excuseReason}
                onChange={(e) => setExcuseReason(e.target.value)}
                placeholder={t("Describe the reason (e.g. traffic, emergency, technical issue)…")}
                rows={4}
                className="w-full resize-none rounded-md border border-border px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              {excuseError && <p className="text-xs text-danger">{excuseError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => { setExcuseModal(null); setExcuseReason(""); }}
                  className="flex h-10 flex-1 items-center justify-center rounded-md border border-border text-sm text-navy-mid transition hover:border-navy"
                >
                  {t("Cancel")}
                </button>
                <button
                  onClick={() => void handleSubmitExcuse()}
                  disabled={submittingExcuse || !excuseReason.trim()}
                  className="flex h-10 flex-1 items-center justify-center rounded-md bg-gold text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-50"
                >
                  {submittingExcuse ? t("Submitting…") : t("Submit")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar Tab ──────────────────────────────────────────────────────────────

function CalendarTab({ orgId, doctorAccountId }: { orgId: string; doctorAccountId: string }) {
  const { branches, memberships } = useOrg();
  const { t, locale } = useLanguage();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState<BackendSession[]>([]);
  const [dayAppointments, setDayAppointments] = useState<BackendAppointment[]>([]);
  const [loadingCal, setLoadingCal] = useState(true);
  const [loadingAppts, setLoadingAppts] = useState(false);

  const myMembershipId =
    memberships.find((m) => m.userId === doctorAccountId && m.userRole === "doctor")?.id ??
    memberships.find((m) => m.userId === doctorAccountId)?.id ?? "";

  // Fetch all sessions for the current month
  useEffect(() => {
    if (!orgId || branches.length === 0) return;
    setLoadingCal(true);
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;

    Promise.all(
      branches.map((b) =>
        sessionService.getSessions(orgId, b.id, { fromDate: from, toDate: to })
      )
    ).then((res) => {
      // getSessions by date returns sessions for that specific date — fetch per day is too many calls.
      // Instead, fetch without date filter and let the backend return the month range if supported.
      // Fallback: fetch "today" across all branches at least so calendar is populated for today.
      const all = res.flat().filter(
        (s) => s.doctorId === myMembershipId || s.doctorId === doctorAccountId,
      );
      setAllSessions(all);
    }).catch(() => setAllSessions([]))
      .finally(() => setLoadingCal(false));
  }, [orgId, branches, myMembershipId, doctorAccountId, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch appointments when a day is selected
  useEffect(() => {
    if (!selectedDate || !orgId || branches.length === 0) {
      setDayAppointments([]);
      return;
    }
    const daySessions = allSessions.filter((s) => s.date === selectedDate);
    if (daySessions.length === 0) { setDayAppointments([]); return; }

    setLoadingAppts(true);
    Promise.all(
      daySessions.map((s) => {
        const branch = branches.find((b) => b.id === s.branchId) ?? branches[0];
        return sessionService.getQueue(orgId, branch.id, s.id).then((q) => q.appointments);
      })
    ).then((nested) => setDayAppointments(nested.flat()))
      .catch(() => setDayAppointments([]))
      .finally(() => setLoadingAppts(false));
  }, [selectedDate, allSessions, orgId, branches]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build calendar grid
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");

  const sessionsByDate = new Map<string, BackendSession[]>();
  for (const s of allSessions) {
    const list = sessionsByDate.get(s.date) ?? [];
    list.push(s);
    sessionsByDate.set(s.date, list);
  }

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  function prevMonth() { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); setSelectedDate(null); }
  function nextMonth() { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); setSelectedDate(null); }

  const statusStyle: Record<string, string> = {
    booked:      "bg-gold-tint text-navy",
    called:      "bg-success/10 text-success",
    in_progress: "bg-success/20 text-success",
    completed:   "bg-border/60 text-navy-mid",
    no_show:     "bg-danger/10 text-danger",
    skipped:     "bg-orange-50 text-orange-600",
    cancelled:   "bg-border/40 text-navy-mid",
  };
  const statusLabel: Record<string, string> = {
    booked: t("Waiting"), called: t("Called"), in_progress: t("In Progress"),
    completed: t("Done"), no_show: t("No-Show"), skipped: t("Skipped"), cancelled: t("Cancelled"),
  };

  return (
    <div className="space-y-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg border border-border p-2 text-navy-mid transition hover:border-navy hover:text-navy">
          ‹
        </button>
        <h2 className="font-heading text-lg font-bold text-navy">{t(MONTHS[month])} {year}</h2>
        <button onClick={nextMonth} className="rounded-lg border border-border p-2 text-navy-mid transition hover:border-navy hover:text-navy">
          ›
        </button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-border bg-offwhite">
          {DOW.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-navy-mid">{t(d)}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[60px] border-b border-r border-border/50" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const sessions = sessionsByDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const bookingsTotal = sessions.reduce((sum, s) => sum + s.bookingsCount, 0);

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`relative min-h-[60px] border-b border-r border-border/50 p-2 text-left transition hover:bg-offwhite/80 ${
                  isSelected ? "bg-navy/5 ring-1 ring-inset ring-navy/20" : ""
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-navy text-white" : "text-navy"
                }`}>
                  {day}
                </span>
                {sessions.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {sessions.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className={`truncate rounded px-1 py-0.5 text-[9px] font-medium ${
                          s.status === "active" ? "bg-success/15 text-success" :
                          s.status === "ended"  ? "bg-border text-navy-mid" :
                                                   "bg-gold/15 text-gold"
                        }`}
                      >
                        {fmt12(s.startTime, locale)}
                      </div>
                    ))}
                    {sessions.length > 2 && (
                      <p className="text-[9px] text-navy-mid">+{sessions.length - 2} more</p>
                    )}
                  </div>
                )}
                {bookingsTotal > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold/20 text-[9px] font-bold text-gold">
                    {bookingsTotal}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedDate && (
        <div className="animate-fade-up rounded-xl border border-border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-base font-bold text-navy">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString(locale === "ar" ? "ar-EG" : "en-EG", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </h3>
            <span className="text-xs text-navy-mid">
              {(sessionsByDate.get(selectedDate) ?? []).length} session{(sessionsByDate.get(selectedDate) ?? []).length !== 1 ? "s" : ""}
            </span>
          </div>

          {loadingCal ? (
            <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-offwhite" />)}</div>
          ) : (sessionsByDate.get(selectedDate) ?? []).length === 0 ? (
            <p className="text-sm text-navy-mid">{t("No sessions on this day.")}</p>
          ) : (
            <div className="space-y-4">
              {(sessionsByDate.get(selectedDate) ?? []).map((s) => (
                <div key={s.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy">{fmt12(s.startTime, locale)} – {fmt12(s.endTime, locale)}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.status === "active" ? "bg-success/10 text-success" :
                      s.status === "ended" ? "bg-border text-navy-mid" :
                      "bg-gold/15 text-gold"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-navy-mid">{s.bookingsCount} booked{s.maxBookings ? ` / ${s.maxBookings} max` : ""}</p>

                  {/* Appointments for this session */}
                  {loadingAppts ? (
                    <div className="mt-3 h-10 animate-pulse rounded-lg bg-offwhite" />
                  ) : dayAppointments.length > 0 && (
                    <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {dayAppointments.map((appt) => (
                        <div key={appt.id} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                              {appt.queueNumber}
                            </span>
                            <div>
                              <p className="text-xs font-medium text-navy">
                                {appt.patientProfile.fullName || "Patient"}
                              </p>
                              <p className="text-[10px] text-navy-mid">{appt.patientProfile.phone}</p>
                              {appt.notes && <p className="mt-0.5 text-[10px] italic text-navy-mid">"{appt.notes}"</p>}
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[appt.status] ?? ""}`}>
                            {statusLabel[appt.status] ?? appt.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
  const { t, locale } = useLanguage();
  const myMembership =
    memberships.find((m) => m.userId === doctorAccountId && m.userRole === "doctor") ??
    memberships.find((m) => m.userId === doctorAccountId);

  const [form, setForm] = useState({
    bio: "",
    specialties: "",
    avatarUrl: "",
    insurances: [] as string[],
    languages: "",
    yearsOfExperience: "",
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Populate form from membership once it loads
  useEffect(() => {
    if (!myMembership) return;
    setForm({
      bio: myMembership.bio ?? "",
      specialties: (myMembership.specialties ?? []).join(", "),
      avatarUrl: myMembership.avatarUrl ?? "",
      insurances: myMembership.acceptedInsurances ?? [],
      languages: (myMembership.languagesSpoken ?? []).join(", "),
      yearsOfExperience: myMembership.yearsOfExperience != null ? String(myMembership.yearsOfExperience) : "",
    });
  }, [myMembership?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!myMembership) {
    return (
      <div className="rounded-xl bg-offwhite py-10 text-center">
        <p className="text-sm text-navy-mid">{t("Profile not found — membership may still be loading.")}</p>
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
    try {
      const specialtiesList = form.specialties.split(",").map((s) => s.trim()).filter(Boolean);
      const languagesList = form.languages.split(",").map((l) => l.trim()).filter(Boolean);
      const yoe = form.yearsOfExperience.trim() !== "" ? Number(form.yearsOfExperience) : null;

      const result = await updateMember(myMembership.id, {
        bio: form.bio.trim() || undefined,
        specialties: specialtiesList.length ? specialtiesList : undefined,
        avatarUrl: form.avatarUrl.trim() || null,
        acceptedInsurances: form.insurances,
        languagesSpoken: languagesList,
        yearsOfExperience: yoe,
      });

      const ok = result === true;
      setResult({
        ok,
        msg: ok
          ? t("Profile updated successfully.")
          : typeof result === "string" ? result : t("Failed to save. Please try again."),
      });
    } finally {
      setSaving(false);
    }
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
          <img src={form.avatarUrl} alt={doctorName} className="h-14 w-14 rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold font-heading text-xl font-bold text-navy">
            {initials}
          </div>
        )}
        <div>
          <p className="font-heading text-lg font-bold text-navy">{doctorName}</p>
          {myMembership.specialties && myMembership.specialties.length > 0 ? (
            <p className="text-sm text-navy-mid">{myMembership.specialties.join(", ")}</p>
          ) : (
            <p className="text-sm italic text-navy-mid/60">{t("No specialty listed")}</p>
          )}
          {myMembership.yearsOfExperience != null && (
            <p className="text-xs text-navy-mid">{myMembership.yearsOfExperience} {t("years experience")}</p>
          )}
          {myMembership.languagesSpoken && myMembership.languagesSpoken.length > 0 && (
            <p className="text-xs text-navy-mid">{t("Speaks:")} {myMembership.languagesSpoken.join(", ")}</p>
          )}
        </div>
      </div>

      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"}`}>
          {result.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-navy">{t("Bio")}</span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={3}
            placeholder="A short description about your background and expertise..."
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-navy">{t("Specialties")}</span>
          <select
            value={form.specialties}
            onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="">{t("Select specialty…")}</option>
            {SPECIALTIES.filter((s) => s !== "All Specialties").map((s) => (
              <option key={s} value={s}>{t(s)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-navy">{t("Avatar URL")}</span>
          <input
            type="text"
            value={form.avatarUrl}
            onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            placeholder="https://..."
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-navy">{t("Languages Spoken")}</span>
          <input
            type="text"
            value={form.languages}
            onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))}
            placeholder="e.g. Arabic, English (comma-separated)"
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-navy">{t("Years of Experience")}</span>
          <input
            type="number"
            min={0}
            value={form.yearsOfExperience}
            onChange={(e) => setForm((f) => ({ ...f, yearsOfExperience: e.target.value }))}
            placeholder="e.g. 10"
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
        <div>
          <span className="text-sm font-medium text-navy">{t("Accepted Insurance")}</span>
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
          {saving ? t("Saving…") : t("Save Profile")}
        </button>
      </form>

      {/* Read-only Weekly Schedule + Earnings Breakdown */}
      {mySchedules.length > 0 && (
        <div className="space-y-3 border-t border-border pt-5">
          <div>
            <h3 className="font-heading text-base font-bold text-navy">{t("My Weekly Schedule")}</h3>
            <p className="mt-0.5 text-xs text-navy-mid">{t("Managed by your clinic administrator.")}</p>
          </div>
          {mySchedules.map((sched) => {
            const branch = branches.find((b) => b.id === sched.branchId);
            const fee = sched.fee ?? 0;
            const platformCut = Math.round(fee * 0.10);
            const orgCut = Math.round((fee - platformCut) * 0.7);
            const doctorNet = fee - platformCut - orgCut;
            return (
              <div key={sched.id} className="rounded-xl border border-border bg-offwhite p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-navy">{branch?.name ?? "Branch"}</p>
                  <span className="text-sm font-medium text-gold">{sched.fee} {t("EGP / visit")}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sched.weeklySlots.map((slot) => (
                    <span
                      key={slot.dayOfWeek}
                      className="rounded-md bg-white px-2.5 py-1 text-xs text-navy-mid border border-border"
                    >
                      {DAY_LABELS[slot.dayOfWeek]} {fmt12(slot.startTime, locale)}–{fmt12(slot.endTime, locale)}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-navy-mid">{sched.avgConsultationMin} {t("min avg. consultation")}</p>
                {fee > 0 && (
                  <div className="mt-3 rounded-lg border border-border bg-white px-3 py-2">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-mid">
                      {t("Earnings per Consultation")}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-navy-mid">{t("Platform (10%)")}</p>
                        <p className="font-medium text-navy">−{platformCut} {t("EGP")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-navy-mid">{t("Clinic (21%)")}</p>
                        <p className="font-medium text-navy">−{orgCut} {t("EGP")}</p>
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
