import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs } from "../components/ui/Tabs";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useQueueSubscription } from "../hooks/useQueueSubscription";
import { getOwnProfile, updateOwnProfile, getOwnAppointmentHistory } from "../services/patientService";
import type { PatientRecord, OwnAppointmentItem } from "../services/patientService";
import type { ActiveBooking } from "../types/index";
import type { PatientProfile } from "../types/index";

// ── Page ──────────────────────────────────────────────────────────────────────

export function PatientDashboard() {
  const { bookings, removeBooking } = useApp();
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [appointmentHistory, setAppointmentHistory] = useState<OwnAppointmentItem[]>([]);

  const patientProfile =
    authUser?.role === "patient" ? authUser.profile : null;

  useEffect(() => {
    if (authUser?.role === "patient") {
      getOwnAppointmentHistory().then(setAppointmentHistory);
    }
  }, [authUser]);

  const dashboardTabs = [
    {
      id: "active",
      label: `Active Bookings${bookings.length > 0 ? ` (${bookings.length})` : ""}`,
      content: (
        <ActiveBookingsTab
          bookings={bookings}
          onGoToTicket={() => navigate("/ticket")}
          onBook={() => navigate("/search")}
          onCancel={(id) => removeBooking(id)}
        />
      ),
    },
    {
      id: "history",
      label: `Past History (${appointmentHistory.length})`,
      content: <HistoryTab history={appointmentHistory} />,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 animate-fade-up">
        <p className="text-sm font-medium text-gold">Your account</p>
        <h1 className="font-heading text-4xl font-bold text-navy">
          My Dashboard
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
              Quick Actions
            </h3>
            <div className="mt-3 space-y-2">
              <ActionBtn
                icon="🔍"
                label="Find Doctors"
                onClick={() => navigate("/search")}
              />
              <ActionBtn
                icon="🎫"
                label={`My Live Ticket${bookings.length > 0 ? ` (${bookings.length})` : ""}`}
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
                  Active booking
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
                  <p className="text-xs text-navy-mid">Queue #</p>
                  <p className="font-heading text-2xl font-bold text-gold">
                    #{bookings[0].queueNumber}
                  </p>
                </div>

                <button
                  onClick={() => navigate("/ticket")}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light"
                >
                  Go to Live Ticket →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Profile Card ──────────────────────────────────────────────────────────────

function ProfileCard({ patient }: { patient: PatientProfile | null }) {
  const [ownProfile, setOwnProfile] = useState<PatientRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", dateOfBirth: "", avatarUrl: "" });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

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
    setSaving(true);
    setSaveResult(null);
    const result = await updateOwnProfile({
      fullName: form.fullName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      avatarUrl: form.avatarUrl.trim() || null,
    });
    setSaving(false);
    if (result) {
      setOwnProfile(result);
      setSaveResult({ ok: true, msg: "Profile updated successfully." });
      setEditing(false);
    } else {
      setSaveResult({ ok: false, msg: "Failed to save. Check your phone number and try again." });
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
              <p className="mt-0.5 text-xs text-white/40">Registered Patient</p>
            </div>
          ) : (
            <div>
              <p className="font-heading text-xl font-bold text-white">Guest</p>
              <p className="mt-0.5 text-sm text-white/60">Please sign in to view your profile.</p>
            </div>
          )}

          {patient && (
            <button
              onClick={() => { setEditing((v) => !v); setSaveResult(null); }}
              className="shrink-0 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/50 hover:text-white"
            >
              {editing ? "Cancel" : "Edit"}
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
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-mid">Edit Profile</h3>
          <label className="block">
            <span className="text-sm font-medium text-navy">Full Name</span>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-navy">Phone</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-navy">Date of Birth</span>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
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
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      ) : patient ? (
        <div className="px-6 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-mid">
            Profile Information
          </h3>
          <dl className="divide-y divide-border">
            <InfoRow label="Full Name" value={displayName} />
            <InfoRow label="Phone Number" value={displayPhone} />
            {birthdateLabel && <InfoRow label="Date of Birth" value={birthdateLabel} />}
            {patient.email && <InfoRow label="Email" value={patient.email} />}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

// ── Active Bookings tab ───────────────────────────────────────────────────────

function ActiveBookingsTab({
  bookings,
  onGoToTicket,
  onBook,
  onCancel,
}: {
  bookings: ActiveBooking[];
  onGoToTicket: () => void;
  onBook: () => void;
  onCancel: (id: string) => void;
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon="🎫"
        title="No active bookings"
        desc="When you book an appointment, your live ticket will appear here."
        cta="Find a Doctor"
        onCta={onBook}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Live
        </span>
        <span className="text-sm text-navy-mid">
          Queue positions are updating in real-time
        </span>
      </div>

      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          onGoToTicket={onGoToTicket}
          onCancel={() => onCancel(booking.id)}
        />
      ))}
    </div>
  );
}

// ── Individual booking card (with live queue + edit notes) ────────────────────

function BookingCard({
  booking,
  onGoToTicket,
  onCancel,
}: {
  booking: ActiveBooking;
  onGoToTicket: () => void;
  onCancel: () => void;
}) {
  const { updateBookingNotes: updateNotes } = useApp();
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesText, setNotesText] = useState(booking.patientNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  // Live queue position per booking — use tracking token if available
  const { position, currentServing, etaMinutes } = useQueueSubscription(
    booking.accessToken ?? booking.id,
    booking.queueNumber,
    booking.session.avgConsultationMin,
  );

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

  const paymentBadge = {
    success: { label: "Paid ✓", cls: "bg-success/10 text-success" },
    failed: { label: "Failed ✕", cls: "bg-danger/10 text-danger" },
    pending: { label: "Pay at Clinic", cls: "bg-border/50 text-navy-mid" },
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
              {booking.session.date} · {booking.session.startTime} –{" "}
              {booking.session.endTime}
            </p>
            <p className="text-xs text-navy-mid">{booking.session.clinicName}</p>
            {clinicDetails?.address && (
              <p className="mt-0.5 text-xs text-navy-mid">
                📍 {clinicDetails.address}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
            ✓ Confirmed
          </span>
        </div>

        {/* Queue status row */}
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
          <StatCell label="Position" value={`#${position}`} accent />
          <StatCell label="Serving" value={`#${currentServing}`} />
          <StatCell label="Est. Wait" value={`~${etaMinutes}m`} />
        </div>

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
              <span className="font-medium">Note to doctor:</span>{" "}
              {booking.patientNotes.slice(0, 60)}
              {booking.patientNotes.length > 60 ? "…" : ""}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 border-t border-border p-4">
          <button
            onClick={onGoToTicket}
            className="col-span-1 flex h-10 items-center justify-center rounded-md bg-gold text-xs font-medium text-navy transition hover:bg-gold-light"
          >
            Live Ticket →
          </button>
          <button
            onClick={() => {
              setNotesText(booking.patientNotes ?? "");
              setShowNotesModal(true);
            }}
            className="flex h-10 items-center justify-center rounded-md border border-border text-xs text-navy-mid transition hover:border-navy hover:text-navy"
          >
            Edit Notes
          </button>
          <button
            onClick={onCancel}
            className="flex h-10 items-center justify-center rounded-md border border-danger/30 text-xs text-danger transition hover:bg-danger hover:text-white"
          >
            Cancel
          </button>
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
                Note to Doctor
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
                Your notes (optional)
              </label>
              <textarea
                value={notesText}
                onChange={(e) =>
                  setNotesText(e.target.value.slice(0, 200))
                }
                placeholder="e.g. Please review my previous X-ray results from last month…"
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
                  {savingNotes ? "Saving…" : "Save Notes"}
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
  if (history.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="No past bookings"
        desc="Your completed and cancelled appointments will appear here."
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
        {isCompleted && record.accessToken && (
          <a
            href={`/review?token=${record.accessToken}`}
            className="mt-1 block text-xs font-medium text-gold hover:text-gold-light"
          >
            Leave a Review →
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
          {isCompleted ? "✓ Completed" : isCancelled ? "✕ Cancelled" : record.status}
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
