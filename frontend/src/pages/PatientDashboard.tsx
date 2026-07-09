import { useState, useEffect, useMemo, useRef } from "react";
import { toE164 } from "../utils/phone";
import { validatePhone, validateName, validateBirthdate } from "../utils/validation";
import { useNavigate } from "react-router-dom";
import { Tabs } from "../components/ui/Tabs";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useQueueSubscription } from "../hooks/useQueueSubscription";
import { getOwnProfile, updateOwnProfile, getOwnAppointmentHistory, getOwnActiveTickets, getMineStatusMap, cancelOwnAppointment } from "../services/patientService";
import type { PatientRecord, OwnAppointmentItem, ActiveTicketItem } from "../services/patientService";
import type { ActiveBooking } from "../types/index";
import type { PatientProfile } from "../types/index";
import { fmt12 } from "../utils/time";
import { RatingPopup } from "../components/ui/RatingPopup";

// ── Page ──────────────────────────────────────────────────────────────────────

type CancelTarget = { id: string; sessionDate: string; sessionStartTime: string };

export function PatientDashboard() {
  const { bookings, removeBooking } = useApp();
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [appointmentHistory, setAppointmentHistory] = useState<OwnAppointmentItem[]>([]);
  const [serverTickets, setServerTickets] = useState<ActiveTicketItem[]>([]);
  const [reviewPrompt, setReviewPrompt] = useState<OwnAppointmentItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  const patientProfile =
    authUser?.role === "patient" ? authUser.profile : null;

  // Stable refs so the polling closure can read current values without
  // being re-created (which would restart the interval timer).
  const bookingsRef = useRef(bookings);
  const removeBookingRef = useRef(removeBooking);
  useEffect(() => { bookingsRef.current = bookings; }, [bookings]);
  useEffect(() => { removeBookingRef.current = removeBooking; }, [removeBooking]);

  useEffect(() => {
    if (authUser?.role !== "patient") return;
    getOwnAppointmentHistory().then((history) => {
      setAppointmentHistory(history);
      // Prompt for the most recent completed-but-unreviewed visit, once per
      // login — showing up here (not just on the ticket page) means a patient
      // who closed their ticket without rating still gets asked next time
      // they sign in, rather than never again.
      const pending = history.find((a) => a.status === "completed" && a.reviewToken && !a.hasReview);
      if (pending) setReviewPrompt(pending);
    }).catch(console.error);

    async function fetchAndReconcile() {
      try {
        const tickets = await getOwnActiveTickets();
        setServerTickets(tickets);
        // Evict localStorage bookings only when the server confirms they're
        // genuinely gone (cancelled, no-show, or the appointment no longer
        // exists) — NOT simply "not active", since a just-completed
        // consultation is also "not active" but must stay visible long
        // enough for the post-visit review popup on the ticket page.
        const statusMap = await getMineStatusMap();
        bookingsRef.current.forEach((b) => {
          const status = statusMap.get(b.id);
          if (status === undefined || status === "cancelled" || status === "no_show") {
            removeBookingRef.current(b.id);
          }
        });
      } catch { /* non-fatal */ }
    }

    void fetchAndReconcile();
    const poll = setInterval(() => { void fetchAndReconcile(); }, 30_000);
    return () => clearInterval(poll);
  }, [authUser]);

  function requestCancel(id: string, sessionDate: string, sessionStartTime: string) {
    setCancelTarget({ id, sessionDate, sessionStartTime });
    setCancelError(null);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOwnAppointment(cancelTarget.id);
      removeBooking(cancelTarget.id);
      setServerTickets((prev) => prev.filter((t) => t.id !== cancelTarget.id));
      setCancelTarget(null);
      setCancelNotice(t("Your booking has been cancelled."));
      setTimeout(() => setCancelNotice(null), 6000);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Failed to cancel. Please try again.";
      setCancelError(msg);
    } finally {
      setCancelling(false);
    }
  }

  const dashboardTabs = useMemo(
    () => [
      {
        id: "active",
        label: `${t("Active Bookings")}${bookings.length > 0 ? ` (${bookings.length})` : ""}`,
        content: (
          <ActiveBookingsTab
            bookings={bookings}
            serverTickets={serverTickets}
            onGoToTicket={() => navigate("/ticket")}
            onBook={() => navigate("/search")}
            onCancel={(id, sessionDate, sessionStartTime) =>
              requestCancel(id, sessionDate, sessionStartTime)
            }
            onRemoveBooking={(id) => removeBooking(id)}
          />
        ),
      },
      {
        id: "history",
        label: `${t("Past History")} (${appointmentHistory.length})`,
        content: <HistoryTab history={appointmentHistory} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings, serverTickets, appointmentHistory],
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {reviewPrompt?.reviewToken && (
        <RatingPopup
          doctorName={reviewPrompt.doctorName}
          reviewToken={reviewPrompt.reviewToken}
          onDismiss={() => setReviewPrompt(null)}
        />
      )}

      <div className="mb-8 animate-fade-up">
        <p className="text-sm font-medium text-gold">{t("Your account")}</p>
        <h1 className="font-heading text-4xl font-bold text-navy">
          {t("My Dashboard")}
        </h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* ── Left: Profile + Tabs ── */}
        <div className="animate-fade-up space-y-6" style={{ animationDelay: "100ms" }}>
          <ProfileCard patient={patientProfile} />

          <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <Tabs items={dashboardTabs} defaultTab="active" />
          </section>
        </div>

        {/* ── Right: Quick actions ── */}
        <div className="animate-slide-in-right space-y-4" style={{ animationDelay: "200ms" }}>
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="font-heading text-base font-bold text-navy">
              {t("Quick Actions")}
            </h3>
            <div className="mt-3 space-y-2">
              <ActionBtn
                icon="🔍"
                label={t("Find Doctors")}
                onClick={() => navigate("/search")}
              />
              <ActionBtn
                icon="🎫"
                label={`${t("My Live Ticket")}${bookings.length > 0 ? ` (${bookings.length})` : ""}`}
                onClick={() => navigate("/ticket")}
                disabled={bookings.length === 0}
              />
            </div>
          </div>

          {/* First active booking mini-card */}
          {bookings[0] && (
            <div className="overflow-hidden rounded-xl border border-gold bg-gold-tint shadow-sm">
              <div className="bg-navy px-4 py-3">
                <p className="text-xs font-medium text-white/70">
                  {t("Active booking")}
                </p>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-heading font-bold text-navy">
                    {bookings[0].doctor.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      {bookings[0].doctor.name}
                    </p>
                    <p className="text-xs text-navy-mid">
                      {bookings[0].session.date}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-md bg-white px-3 py-2">
                  <p className="text-xs text-navy-mid">{t("Queue #")}</p>
                  <p className="font-heading text-2xl font-bold text-gold">
                    #{bookings[0].queueNumber}
                  </p>
                </div>

                <button
                  onClick={() => navigate("/ticket")}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light"
                >
                  {t("Go to Live Ticket →")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation notice toast */}
      {cancelNotice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-xl border border-success/30 bg-white px-5 py-3 shadow-xl">
          <p className="text-sm text-navy">{cancelNotice}</p>
        </div>
      )}

      {/* Cancellation confirmation modal */}
      {cancelTarget && (
        <CancelBookingModal
          sessionDate={cancelTarget.sessionDate}
          sessionStartTime={cancelTarget.sessionStartTime}
          cancelling={cancelling}
          error={cancelError}
          onConfirm={confirmCancel}
          onClose={() => { setCancelTarget(null); setCancelError(null); }}
        />
      )}
    </main>
  );
}

// ── Cancellation Modal ────────────────────────────────────────────────────────

function CancelBookingModal({
  sessionDate,
  sessionStartTime,
  cancelling,
  error,
  onConfirm,
  onClose,
}: {
  sessionDate: string;
  sessionStartTime: string;
  cancelling: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-danger px-6 py-4">
          <p className="font-heading text-base font-bold text-white">{t("Cancel Appointment")}</p>
          <p className="mt-0.5 text-xs text-white/70">{sessionDate} · {sessionStartTime}</p>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-navy-mid">
            {t("Are you sure you want to cancel this appointment? This action cannot be undone.")}
          </p>

          {error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={cancelling}
              className="flex-1 rounded-md border border-border py-2 text-sm font-medium text-navy-mid transition hover:border-navy hover:text-navy disabled:opacity-60"
            >
              {t("Keep Booking")}
            </button>
            <button
              onClick={onConfirm}
              disabled={cancelling}
              className="flex-1 rounded-md bg-danger py-2 text-sm font-medium text-white transition hover:bg-danger/90 disabled:opacity-60"
            >
              {cancelling ? t("Cancelling…") : t("Yes, Cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile Card ──────────────────────────────────────────────────────────────

function ProfileCard({ patient }: { patient: PatientProfile | null }) {
  const { t } = useLanguage();
  const [ownProfile, setOwnProfile] = useState<PatientRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", dateOfBirth: "", avatarUrl: "" });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [dobError, setDobError] = useState("");

  useEffect(() => {
    getOwnProfile().then((p) => {
      if (p) {
        setOwnProfile(p);
        setForm({
          fullName: p.fullName,
          phone: p.phone,
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "",
          avatarUrl: p.avatarUrl ?? "",
        });
      }
    });
  }, []);

  const displayName = ownProfile?.fullName ?? patient?.name ?? "Guest";
  const displayPhone = ownProfile?.phone ?? patient?.phone ?? "";
  const displayAvatar = ownProfile?.avatarUrl ?? "";

  const initials = displayName
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  const birthdateLabel = ownProfile?.dateOfBirth
    ? new Date(ownProfile.dateOfBirth).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : patient?.birthdate
      ? new Date(patient.birthdate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setNameError("");
    setPhoneError("");
    setDobError("");
    if (form.fullName.trim()) {
      const nm = validateName(form.fullName.trim());
      if (!nm.valid) { setNameError(t(nm.error)); return; }
    }
    if (form.phone.trim()) {
      const ph = validatePhone(form.phone.trim());
      if (!ph.valid) { setPhoneError(ph.error); return; }
    }
    if (form.dateOfBirth) {
      const bd = validateBirthdate(form.dateOfBirth);
      if (!bd.valid) { setDobError(t(bd.error)); return; }
    }
    setSaving(true);
    setSaveResult(null);
    const result = await updateOwnProfile({
      fullName: form.fullName.trim() || undefined,
      phone: form.phone.trim() ? toE164(form.phone.trim()) : undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      avatarUrl: form.avatarUrl.trim() || null,
    });
    setSaving(false);
    if (result) {
      setOwnProfile(result);
      setSaveResult({ ok: true, msg: t("Profile updated successfully.") });
      setEditing(false);
    } else {
      setSaveResult({ ok: false, msg: t("Failed to save. Check your phone number and try again.") });
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="bg-navy px-6 py-5">
        <div className="flex items-center gap-4">
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt={displayName}
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold font-heading text-2xl font-bold text-navy">
              {initials}
            </div>
          )}

          {patient ? (
            <div className="flex-1 min-w-0">
              <p className="font-heading text-xl font-bold text-white">{displayName}</p>
              <p className="mt-0.5 text-sm text-white/60">{displayPhone}</p>
              <p className="mt-0.5 text-xs text-white/40">{t("Registered Patient")}</p>
            </div>
          ) : (
            <div>
              <p className="font-heading text-xl font-bold text-white">{t("Guest")}</p>
              <p className="mt-0.5 text-sm text-white/60">{t("Please sign in to view your profile.")}</p>
            </div>
          )}

          {patient && (
            <button
              onClick={() => { setEditing((v) => !v); setSaveResult(null); }}
              className="shrink-0 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/50 hover:text-white"
            >
              {editing ? t("Cancel") : t("Edit")}
            </button>
          )}
        </div>
      </div>

      {saveResult && (
        <div className={`px-6 pt-4 text-sm ${saveResult.ok ? "text-success" : "text-danger"}`}>
          {saveResult.msg}
        </div>
      )}

      {patient && editing ? (
        <form onSubmit={handleSave} className="px-6 py-4 space-y-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-mid">{t("Edit Profile")}</h3>
          <div className="block">
            <span className="text-sm font-medium text-navy">{t("Full Name")}</span>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => { setNameError(""); setForm((f) => ({ ...f, fullName: e.target.value })); }}
              className={`mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm text-navy outline-none focus:ring-2 ${nameError ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border focus:border-gold focus:ring-gold/20"}`}
            />
            {nameError && <p className="mt-1 text-xs text-danger">{nameError}</p>}
          </div>
          <div className="block">
            <span className="text-sm font-medium text-navy">{t("Phone")}</span>
            <div className={`mt-1 flex h-10 overflow-hidden rounded-md border bg-white focus-within:ring-2 ${phoneError ? "border-danger focus-within:ring-danger/20" : "border-border focus-within:border-gold focus-within:ring-gold/20"}`}>
              <span className="flex shrink-0 items-center border-r border-border bg-offwhite px-2 text-xs font-medium text-navy-mid">+20</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => { setPhoneError(""); setForm((f) => ({ ...f, phone: e.target.value })); }}
                placeholder="1XXXXXXXXX"
                inputMode="numeric"
                className="h-full flex-1 bg-transparent px-3 text-sm text-navy outline-none"
              />
            </div>
            {phoneError && <p className="mt-1 text-xs text-danger">{phoneError}</p>}
          </div>
          <div className="block">
            <span className="text-sm font-medium text-navy">{t("Date of Birth")}</span>
            <input
              type="date"
              value={form.dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              min={`${new Date().getFullYear() - 120}-01-01`}
              onChange={(e) => { setDobError(""); setForm((f) => ({ ...f, dateOfBirth: e.target.value })); }}
              className={`mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm text-navy outline-none focus:ring-2 ${dobError ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border focus:border-gold focus:ring-gold/20"}`}
            />
            {dobError && <p className="mt-1 text-xs text-danger">{dobError}</p>}
          </div>
          <label className="block">
            <span className="text-sm font-medium text-navy">{t("Avatar URL")}</span>
            <input
              type="url"
              value={form.avatarUrl}
              onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
              placeholder="https://..."
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 rounded-md border border-border py-2 text-sm text-navy-mid transition hover:border-navy hover:text-navy"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-gold py-2 text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
            >
              {saving ? t("Saving…") : t("Save Changes")}
            </button>
          </div>
        </form>
      ) : patient ? (
        <div className="px-6 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-mid">
            {t("Profile Information")}
          </h3>
          <dl className="divide-y divide-border">
            <InfoRow label={t("Full Name")} value={displayName} />
            <InfoRow label={t("Phone Number")} value={displayPhone} />
            {birthdateLabel && <InfoRow label={t("Date of Birth")} value={birthdateLabel} />}
            {patient.email && <InfoRow label={t("Email")} value={patient.email} />}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

// ── Active Bookings tab ───────────────────────────────────────────────────────

function ActiveBookingsTab({
  bookings,
  serverTickets,
  onGoToTicket,
  onBook,
  onCancel,
  onRemoveBooking,
}: {
  bookings: ActiveBooking[];
  serverTickets: ActiveTicketItem[];
  onGoToTicket: () => void;
  onBook: () => void;
  onCancel: (id: string, sessionDate: string, sessionStartTime: string) => void;
  onRemoveBooking: (id: string) => void;
}) {
  const { t } = useLanguage();
  // Server tickets not already tracked in local bookings (e.g. logged in on new device).
  // Dedup by both appointment ID and accessToken: if bookings haven't reloaded from
  // the user's localStorage key yet when the server response arrives, localIds will be
  // temporarily empty. The accessToken check catches that window.
  const localIds = new Set(bookings.map((b) => b.id));
  const localTokens = new Set(
    bookings.map((b) => b.accessToken).filter((t): t is string => Boolean(t)),
  );
  const orphanTickets = serverTickets.filter(
    (t) => t.accessToken && !localIds.has(t.id) && !localTokens.has(t.accessToken),
  );

  if (bookings.length === 0 && orphanTickets.length === 0) {
    return (
      <EmptyState
        icon="🎫"
        title={t("No active bookings")}
        desc={t("When you book an appointment, your live ticket will appear here.")}
        cta={t("Find a Doctor")}
        onCta={onBook}
      />
    );
  }

  const hasOpenSession = bookings.some((b) => {
    try {
      const [hh, mm] = (b.session.endTime ?? "00:00").split(":").map(Number);
      const end = new Date(`${b.session.date}T00:00:00`);
      end.setHours(hh ?? 0, mm ?? 0, 0, 0);
      return end >= new Date();
    } catch { return true; }
  });

  return (
    <div className="space-y-5">
      {hasOpenSession && (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            {t("Live")}
          </span>
          <span className="text-sm text-navy-mid">
            {t("Queue positions are updating in real-time")}
          </span>
        </div>
      )}

      {[...bookings].sort((a, b) => {
        const ta = `${a.session.date}T${a.session.startTime ?? "00:00"}`;
        const tb = `${b.session.date}T${b.session.startTime ?? "00:00"}`;
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      }).map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          onGoToTicket={onGoToTicket}
          onCancel={() => onCancel(booking.id, booking.session.date, booking.session.startTime)}
          onRemove={() => onRemoveBooking(booking.id)}
        />
      ))}

      {/* Tickets found in MongoDB but not in localStorage (cross-device sync) */}
      {orphanTickets.length > 0 && (
        <>
          {bookings.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-mid">
              {t("Also found on your account")}
            </p>
          )}
          <div className="space-y-3">
            {orphanTickets.map((t) => (
              <ServerTicketCard key={t.id} ticket={t} onCancel={onCancel} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Server-sourced ticket card (cross-device) ─────────────────────────────────

function ServerTicketCard({
  ticket,
  onCancel,
}: {
  ticket: ActiveTicketItem;
  onCancel: (id: string, sessionDate: string, sessionStartTime: string) => void;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const initials = ticket.doctorName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

  const sessionEnded = (() => {
    try {
      const [hh, mm] = (ticket.sessionEndTime ?? "00:00").split(":").map(Number);
      const end = new Date(`${ticket.sessionDate}T00:00:00`);
      end.setHours(hh ?? 0, mm ?? 0, 0, 0);
      return end < new Date();
    } catch { return false; }
  })();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-start gap-4 bg-offwhite px-5 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-lg font-bold text-navy">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading text-lg font-bold text-navy">{ticket.doctorName}</p>
          {ticket.specialty && (
            <p className="text-sm text-navy-mid">{ticket.specialty}</p>
          )}
          <p className="mt-0.5 text-xs text-navy-mid">
            {ticket.sessionDate}
            {ticket.sessionStartTime ? ` · ${ticket.sessionStartTime}` : ""}
            {ticket.sessionEndTime ? ` – ${ticket.sessionEndTime}` : ""}
          </p>
          {ticket.clinicName && (
            <p className="text-xs text-navy-mid">{ticket.clinicName}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full bg-gold-tint px-3 py-1 text-xs font-medium text-navy">
          #{ticket.queueNumber}
        </div>
      </div>
      <div className={`grid border-t border-border p-4 gap-2 ${sessionEnded ? "grid-cols-1" : "grid-cols-2"}`}>
        <button
          onClick={() => navigate(`/ticket/${ticket.accessToken}`)}
          className="flex h-10 w-full items-center justify-center gap-1 rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          {t("View Live Ticket →")}
        </button>
        {!sessionEnded && (
          <button
            onClick={() => onCancel(ticket.id, ticket.sessionDate, ticket.sessionStartTime)}
            className="flex h-10 items-center justify-center rounded-md border border-danger/30 text-xs text-danger transition hover:bg-danger hover:text-white"
          >
            {t("Cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Individual booking card (with live queue + edit notes) ────────────────────

function BookingCard({
  booking,
  onGoToTicket,
  onCancel,
  onRemove,
}: {
  booking: ActiveBooking;
  onGoToTicket: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const { updateBookingNotes: updateNotes } = useApp();
  const { t, locale } = useLanguage();
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesText, setNotesText] = useState(booking.patientNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  // Live queue position per booking — use tracking token if available
  const { position, currentServing, etaMinutes, appointmentStatus, sessionStatus } = useQueueSubscription(
    booking.accessToken ?? booking.id,
    booking.queueNumber,
    booking.session.avgConsultationMin,
  );

  // Remove the card immediately when the server reports it as cancelled externally
  const onRemoveRef = useRef(onRemove);
  useEffect(() => { onRemoveRef.current = onRemove; }, [onRemove]);
  useEffect(() => {
    if (appointmentStatus === "cancelled") onRemoveRef.current();
  }, [appointmentStatus]);

  // Clinic address from doctor's clinic list
  const clinicDetails = booking.doctor.clinics.find(
    (c) => c.id === booking.session.clinicId,
  );

  async function handleSaveNotes() {
    setSavingNotes(true);
    updateNotes(booking.id, notesText);
    setSavingNotes(false);
    setShowNotesModal(false);
  }

  // Prefer the backend's authoritative session status (already polled live by
  // useQueueSubscription, same as the live ticket page) over guessing from
  // wall-clock time — the wall-clock check only stands in before the first
  // poll resolves (sessionStatus === ""), so this card doesn't go stale
  // relative to what the live ticket page shows for the same appointment.
  const sessionWindowClosed = sessionStatus
    ? sessionStatus === "ended" || sessionStatus === "cancelled"
    : (() => {
        try {
          const [hh, mm] = (booking.session.endTime ?? "00:00").split(":").map(Number);
          const end = new Date(`${booking.session.date}T00:00:00`);
          end.setHours(hh ?? 0, mm ?? 0, 0, 0);
          return end < new Date();
        } catch { return false; }
      })();

  const paymentBadge = {
    success: { label: t("Paid ✓"), cls: "bg-success/10 text-success" },
    failed: { label: t("Failed ✕"), cls: "bg-danger/10 text-danger" },
    pending: { label: t("Pay at Clinic"), cls: "bg-border/50 text-navy-mid" },
  }[booking.paymentStatus];

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        {/* Doctor info header */}
        <div className="flex items-start gap-4 bg-offwhite px-5 py-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-xl font-bold text-navy">
            {booking.doctor.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading text-xl font-bold text-navy">
              {booking.doctor.name}
            </p>
            <p className="text-sm text-navy-mid">
              {booking.doctor.specialty} · {booking.doctor.area}
            </p>
            <p className="mt-0.5 text-xs text-navy-mid">
              {booking.session.date} · {fmt12(booking.session.startTime, locale)} –{" "}
              {fmt12(booking.session.endTime, locale)}
            </p>
            <p className="text-xs text-navy-mid">{booking.session.clinicName}</p>
            {clinicDetails?.address && (
              <p className="mt-0.5 text-xs text-navy-mid">
                📍 {clinicDetails.address}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            sessionWindowClosed
              ? "bg-danger/10 text-danger"
              : "bg-success/10 text-success"
          }`}>
            {sessionWindowClosed ? `🔒 ${t("Session Closed")}` : `✓ ${t("Confirmed")}`}
          </span>
        </div>

        {/* Queue status row */}
        {sessionWindowClosed ? (
          <div className="border-t border-danger/20 bg-danger/5 px-5 py-3 text-center">
            <p className="text-xs text-danger">
              {t("Session window has ended — no further queue updates.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
            <StatCell label={t("Position")} value={`#${position}`} accent />
            <StatCell label={t("Serving")} value={`#${currentServing}`} />
            <StatCell label={t("Est. Wait")} value={`~${etaMinutes}m`} />
          </div>
        )}

        {/* Payment + fee row */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge.cls}`}
            >
              {paymentBadge.label}
            </span>
            {booking.transactionId && (
              <span className="font-mono text-[10px] text-navy-mid">
                {booking.transactionId}
              </span>
            )}
          </div>
          <span className="text-sm font-semibold text-navy">
            {booking.doctor.fee} EGP
          </span>
        </div>

        {/* Patient notes preview */}
        {booking.patientNotes && (
          <div className="border-t border-border bg-offwhite/50 px-5 py-2.5">
            <p className="text-xs text-navy-mid">
              <span className="font-medium">{t("Note to doctor:")} </span>
              {booking.patientNotes.slice(0, 60)}
              {booking.patientNotes.length > 60 ? "…" : ""}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className={`grid gap-2 border-t border-border p-4 ${sessionWindowClosed ? "grid-cols-1" : "grid-cols-3"}`}>
          <button
            onClick={onGoToTicket}
            className="flex h-10 items-center justify-center rounded-md bg-gold text-xs font-medium text-navy transition hover:bg-gold-light"
          >
            {sessionWindowClosed ? t("View Ticket →") : t("Live Ticket →")}
          </button>
          {!sessionWindowClosed && (
            <>
              <button
                onClick={() => {
                  setNotesText(booking.patientNotes ?? "");
                  setShowNotesModal(true);
                }}
                className="flex h-10 items-center justify-center rounded-md border border-border text-xs text-navy-mid transition hover:border-navy hover:text-navy"
              >
                {t("Edit Notes")}
              </button>
              <button
                onClick={onCancel}
                className="flex h-10 items-center justify-center rounded-md border border-danger/30 text-xs text-danger transition hover:bg-danger hover:text-white"
              >
                {t("Cancel")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Notes modal */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
            onClick={() => setShowNotesModal(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-navy px-6 py-4">
              <p className="font-heading text-base font-bold text-white">
                {t("Note to Doctor")}
              </p>
              <p className="mt-0.5 text-xs text-white/50">
                {booking.doctor.name} · {booking.session.date}
              </p>
            </div>
            <button
              onClick={() => setShowNotesModal(false)}
              className="absolute right-4 top-4 text-lg text-white/50 transition hover:text-white"
            >
              ✕
            </button>

            <div className="p-6">
              <label className="block text-sm font-medium text-navy">
                {t("Your notes (optional)")}
              </label>
              <textarea
                value={notesText}
                onChange={(e) =>
                  setNotesText(e.target.value.slice(0, 200))
                }
                placeholder={t("e.g. Please review my previous X-ray results from last month…")}
                rows={4}
                className="mt-2 w-full resize-none rounded-md border border-border bg-white p-3 text-sm text-navy outline-none transition focus:border-gold focus:ring-1 focus:ring-gold"
              />
              <p className="mt-1 text-right text-xs text-navy-mid">
                {notesText.length}/200
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="flex-1 rounded-md border border-border py-2.5 text-sm text-navy-mid transition hover:text-navy"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="flex-1 rounded-md bg-gold py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
                >
                  {savingNotes ? t("Saving…") : t("Save Notes")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Past History tab ──────────────────────────────────────────────────────────

function HistoryTab({ history }: { history: OwnAppointmentItem[] }) {
  const { t } = useLanguage();
  if (history.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title={t("No past bookings")}
        desc={t("Your completed and cancelled appointments will appear here.")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {history.map((record) => (
        <HistoryRow key={record.id} record={record} />
      ))}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HistoryRow({ record }: { record: OwnAppointmentItem }) {
  const { t } = useLanguage();
  const isCompleted = record.status === "completed";
  const isCancelled = record.status === "cancelled" || record.status === "no_show";
  const initials = record.doctorName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition hover:border-navy/20">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading font-bold text-navy">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy">
          {record.doctorName}
        </p>
        <p className="text-xs text-navy-mid">
          {record.specialty}{record.specialty && record.sessionDate ? " · " : ""}{record.sessionDate}
        </p>
        {record.clinicName && (
          <p className="text-xs text-navy-mid">{record.clinicName}</p>
        )}
        {record.sessionClosureNote && (
          <p className="mt-1 rounded bg-danger/5 px-2 py-1 text-xs text-danger">
            {t(record.sessionClosureNote)}
          </p>
        )}
        {isCompleted && record.reviewToken && !record.hasReview && (
          <a
            href={`/review?token=${record.reviewToken}`}
            className="mt-1 block text-xs font-medium text-gold hover:text-gold-light"
          >
            {t("Leave a Review →")}
          </a>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isCompleted
              ? "bg-success/10 text-success"
              : isCancelled
                ? "bg-danger/10 text-danger"
                : "bg-gold-tint text-gold"
          }`}
        >
          {isCompleted ? `✓ ${t("Completed")}` : isCancelled ? `✕ ${t("Cancelled")}` : record.status}
        </span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-sm text-navy-mid">{label}</dt>
      <dd className="text-sm font-semibold text-navy">{value}</dd>
    </div>
  );
}

function StatCell({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="px-4 py-3 text-center">
      <p
        className={`font-heading text-xl font-bold ${
          accent ? "text-gold" : "text-navy"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-navy-mid">{label}</p>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm text-navy transition hover:border-gold hover:bg-gold-tint disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span className="ml-auto text-navy-mid">→</span>
    </button>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  cta,
  onCta,
}: {
  icon: string;
  title: string;
  desc: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="rounded-xl bg-offwhite px-6 py-12 text-center">
      <p className="text-4xl">{icon}</p>
      <p className="mt-3 font-heading text-lg font-bold text-navy">{title}</p>
      <p className="mt-1 text-sm text-navy-mid">{desc}</p>
      {cta && onCta && (
        <button
          onClick={onCta}
          className="mt-5 rounded-md bg-gold px-5 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          {cta}
        </button>
      )}
    </div>
  );
}
