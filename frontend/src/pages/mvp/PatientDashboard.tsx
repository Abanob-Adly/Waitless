import type { Patient, ActiveBooking } from "../../App";

// ── Props ─────────────────────────────────────────────────────────────────────

type PatientDashboardProps = {
  patient: Patient | null;
  booking: ActiveBooking | null;
  onGoToTicket: () => void;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export function PatientDashboard({
  patient,
  booking,
  onGoToTicket,
}: PatientDashboardProps) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-heading text-4xl font-bold text-navy">
        My Dashboard
      </h1>
      <p className="mt-2 text-sm text-navy-mid">
        Your profile and active bookings at a glance.
      </p>

      {/* ── Profile Summary ── */}
      <section className="mt-8 rounded-lg border border-border bg-white p-6 shadow-sm">
        <h2 className="font-heading text-2xl font-bold text-navy">
          Profile Summary
        </h2>

        {patient ? (
          <dl className="mt-5 divide-y divide-border">
            <InfoRow label="Full Name" value={patient.name} />
            <InfoRow label="Phone Number" value={patient.phone} />
          </dl>
        ) : (
          <EmptyState
            icon="👤"
            message="No profile yet. Book an appointment to create your profile automatically."
          />
        )}
      </section>

      {/* ── Active Ticket ── */}
      <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-navy">
            Active Booking
          </h2>
          {booking && (
            <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Live
            </span>
          )}
        </div>

        {booking ? (
          <div className="mt-5">
            {/* Doctor row */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-xl font-bold text-navy">
                {booking.doctor.initials}
              </div>

              <div>
                <p className="font-heading text-xl font-bold text-navy">
                  {booking.doctor.name}
                </p>
                <p className="mt-0.5 text-sm text-navy-mid">
                  {booking.doctor.specialty} · {booking.doctor.area}
                </p>
                <p className="mt-0.5 text-xs text-navy-mid">{booking.date}</p>
              </div>
            </div>

            {/* Queue number highlight */}
            <div className="mt-5 grid grid-cols-3 gap-3 rounded-md bg-gold-tint p-4">
              <TicketStat
                label="Queue Number"
                value={`#${booking.queueNumber}`}
                large
                accent
              />
              <TicketStat label="Specialty" value={booking.doctor.specialty} />
              <TicketStat
                label="Consult Fee"
                value={`${booking.doctor.fee} EGP`}
              />
            </div>

            {/* CTA */}
            <button
              onClick={onGoToTicket}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
            >
              Go to Live Ticket
              <span>→</span>
            </button>
          </div>
        ) : (
          <EmptyState
            icon="🎫"
            message="No active booking. Head to Find Doctors to book an appointment."
          />
        )}
      </section>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-sm font-medium text-navy-mid">{label}</dt>
      <dd className="text-sm font-semibold text-navy">{value}</dd>
    </div>
  );
}

function TicketStat({
  label,
  value,
  large = false,
  accent = false,
}: {
  label: string;
  value: string;
  large?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`font-heading font-bold ${large ? "text-3xl" : "text-xl"} ${
          accent ? "text-gold" : "text-navy"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-navy-mid">{label}</p>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="mt-5 rounded-md bg-offwhite px-6 py-10 text-center">
      <p className="text-4xl">{icon}</p>
      <p className="mt-3 text-sm text-navy-mid">{message}</p>
    </div>
  );
}
