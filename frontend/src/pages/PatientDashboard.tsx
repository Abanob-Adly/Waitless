import { useNavigate } from "react-router-dom";
import { Tabs } from "../components/ui/Tabs";
import { useApp } from "../context/AppContext";
import type {
  HistoryRecord,
  ActiveBooking,
  Patient,
} from "../context/AppContext";

// ── Page ──────────────────────────────────────────────────────────────────────

export function PatientDashboard() {
  const { patient, booking, history } = useApp();
  const navigate = useNavigate();

  const dashboardTabs = [
    {
      id: "active",
      label: "Active Bookings",
      content: (
        <ActiveBookingsTab
          booking={booking}
          onGoToTicket={() => navigate("/ticket")}
          onBook={() => navigate("/search")}
        />
      ),
    },
    {
      id: "history",
      label: `Past History (${history.length})`,
      content: <HistoryTab history={history} />,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Page heading */}
      <div className="mb-8">
        <p className="text-sm font-medium text-gold">Your account</p>
        <h1 className="font-heading text-4xl font-bold text-navy">
          My Dashboard
        </h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* ── Left: Profile + Tabs ── */}
        <div className="space-y-6">
          {/* Profile card */}
          <ProfileCard patient={patient} />

          {/* Dashboard tabs */}
          <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <Tabs items={dashboardTabs} defaultTab="active" />
          </section>
        </div>

        {/* ── Right: Quick actions ── */}
        <div className="space-y-4">
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
                label="My Live Ticket"
                onClick={() => navigate("/ticket")}
                disabled={!booking}
              />
            </div>
          </div>

          {/* Active booking mini-card (always visible in sidebar) */}
          {booking && (
            <div className="overflow-hidden rounded-xl border border-gold bg-gold-tint shadow-sm">
              <div className="bg-navy px-4 py-3">
                <p className="text-xs font-medium text-white/70">
                  Active booking
                </p>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-heading font-bold text-navy">
                    {booking.doctor.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      {booking.doctor.name}
                    </p>
                    <p className="text-xs text-navy-mid">
                      {booking.session.date}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-md bg-white px-3 py-2">
                  <p className="text-xs text-navy-mid">Queue #</p>
                  <p className="font-heading text-2xl font-bold text-gold">
                    #{booking.queueNumber}
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

function ProfileCard({ patient }: { patient: Patient | null }) {
  const initials = patient
    ? patient.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {/* Navy strip */}
      <div className="bg-navy px-6 py-5">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold font-heading text-2xl font-bold text-navy">
            {initials}
          </div>

          {patient ? (
            <div>
              <p className="font-heading text-xl font-bold text-white">
                {patient.name}
              </p>
              <p className="mt-0.5 text-sm text-white/60">{patient.phone}</p>
              <p className="mt-0.5 text-xs text-white/40">
                Arabic · English · Registered Patient
              </p>
            </div>
          ) : (
            <div>
              <p className="font-heading text-xl font-bold text-white">
                Guest
              </p>
              <p className="mt-0.5 text-sm text-white/60">
                No profile yet — book an appointment to create yours.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail rows */}
      {patient && (
        <div className="px-6 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-mid">
            Profile Information
          </h3>
          <dl className="divide-y divide-border">
            <InfoRow label="Full Name" value={patient.name} />
            <InfoRow label="Phone Number" value={patient.phone} />
            <InfoRow label="Language" value="Arabic, English" />
            <InfoRow label="Member Since" value="Jun 2026" />
          </dl>

          <p className="mt-4 text-xs text-navy-mid">
            To update your profile details, please contact support.
          </p>
        </div>
      )}
    </section>
  );
}

// ── Active Bookings tab content ───────────────────────────────────────────────

function ActiveBookingsTab({
  booking,
  onGoToTicket,
  onBook,
}: {
  booking: ActiveBooking | null;
  onGoToTicket: () => void;
  onBook: () => void;
}) {
  if (!booking) {
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
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Live
        </span>
        <span className="text-sm text-navy-mid">
          Queue position is updating in real-time
        </span>
      </div>

      {/* Booking card */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-start gap-4 bg-offwhite px-5 py-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-xl font-bold text-navy">
            {booking.doctor.initials}
          </div>
          <div className="flex-1">
            <p className="font-heading text-xl font-bold text-navy">
              {booking.doctor.name}
            </p>
            <p className="text-sm text-navy-mid">
              {booking.doctor.specialty} · {booking.doctor.area}
            </p>
            <p className="mt-0.5 text-xs text-navy-mid">
              {booking.session.date} · {booking.session.startTime}
            </p>
            <p className="text-xs text-navy-mid">
              {booking.session.clinicName}
            </p>
          </div>
          <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
            ✓ Confirmed
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
          <StatCell
            label="Queue #"
            value={`#${booking.queueNumber}`}
            accent
          />
          <StatCell label="Est. Wait" value={`~${booking.queueNumber * booking.session.avgConsultationMin}m`} />
          <StatCell label="Fee" value={`${booking.doctor.fee} EGP`} />
        </div>

        {/* CTA */}
        <div className="border-t border-border p-4">
          <button
            onClick={onGoToTicket}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light"
          >
            Go to Live Ticket →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Past History tab content ──────────────────────────────────────────────────

function HistoryTab({ history }: { history: HistoryRecord[] }) {
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

function HistoryRow({ record }: { record: HistoryRecord }) {
  const isCompleted = record.status === "completed";
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition hover:border-navy/20">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading font-bold text-navy">
        {record.doctorInitials}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy">
          {record.doctorName}
        </p>
        <p className="text-xs text-navy-mid">
          {record.specialty} · {record.date}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isCompleted
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {isCompleted ? "✓ Completed" : "✕ Cancelled"}
        </span>
        <p className="mt-1 text-xs font-medium text-navy-mid">
          {record.fee} EGP
        </p>
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
