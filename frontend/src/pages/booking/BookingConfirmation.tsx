import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";

// ── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = "card" | "vodafone_cash" | "pay_at_clinic";

// Passed via React Router state from DoctorProfile
type BookingState = {
  doctorId: string;
  sessionId: string;
  doctorName: string;
  doctorInitials: string;
  doctorTitle: string;
  clinicName: string;
  date: string;
  startTime: string;
  fee: number;
  patientName: string;
};

type QueueResult = {
  appointmentId: string;
  queueNumber: number;
  estimatedWaitMinutes: number;
};

// ── Mock API ─────────────────────────────────────────────────────────────────
// Simulates: POST /api/appointments   (Flow 11 — Queue Join)
// Returns the assigned queueNumber + ETA once the real backend is wired up.

async function mockJoinQueue(_sessionId: string): Promise<QueueResult> {
  await new Promise((r) => setTimeout(r, 1400));
  const queueNumber = Math.floor(Math.random() * 8) + 2;
  return {
    appointmentId: "booking-001",
    queueNumber,
    estimatedWaitMinutes: queueNumber * 12,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Step = "confirm" | "processing" | "success";

export function BookingConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state as BookingState | null;

  const [step, setStep] = useState<Step>("confirm");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("pay_at_clinic");
  const [queueResult, setQueueResult] = useState<QueueResult | null>(null);

  // Guard: arrived without router state (e.g. direct URL visit)
  if (!booking && step === "confirm") {
    return (
      <div className="min-h-screen bg-offwhite">
        <Navbar />
        <main className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="font-heading text-2xl font-bold text-navy">
            No booking in progress
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-medium text-gold hover:text-gold-light"
          >
            ← Browse doctors
          </Link>
        </main>
      </div>
    );
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setStep("processing");
    const result = await mockJoinQueue(booking!.sessionId);
    setQueueResult(result);
    setStep("success");
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* ── Step 1: Payment form ── */}
        {step === "confirm" && booking && (
          <>
            <Link
              to={`/doctors/${booking.doctorId}`}
              className="text-sm font-medium text-navy-mid hover:text-gold"
            >
              ← Back to doctor profile
            </Link>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
              {/* Payment section */}
              <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
                <h1 className="font-heading text-4xl font-bold text-navy">
                  Complete Payment
                </h1>
                <p className="mt-2 text-navy-mid">
                  Choose your payment method and confirm your booking.
                </p>

                {/* Method tabs */}
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {(
                    [
                      { id: "pay_at_clinic" as const, label: "🏥 Pay at Clinic" },
                      { id: "card" as const, label: "💳 Credit/Debit" },
                      { id: "vodafone_cash" as const, label: "📱 Vodafone Cash" },
                    ] as const
                  ).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaymentMethod(id)}
                      className={`rounded-md border p-3 text-left text-sm font-medium transition ${
                        paymentMethod === id
                          ? "border-gold bg-gold-tint text-navy"
                          : "border-border text-navy-mid hover:border-gold hover:text-navy"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleConfirm} className="mt-8">
                  {paymentMethod === "card" && <CardForm />}

                  {paymentMethod === "vodafone_cash" && (
                    <InfoBox title="Vodafone Cash">
                      <p className="mt-2 text-sm text-navy-mid">
                        Payment confirmation will be handled by our Vodafone
                        Cash integration (coming soon).
                      </p>
                      <label className="mt-5 block">
                        <span className="text-sm font-medium text-navy">
                          Vodafone Cash Number *
                        </span>
                        <input
                          type="tel"
                          placeholder="01XXXXXXXXX"
                          className="mt-2 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm outline-none focus:border-gold"
                        />
                      </label>
                    </InfoBox>
                  )}

                  {paymentMethod === "pay_at_clinic" && (
                    <InfoBox title="Pay at Clinic">
                      <p className="mt-2 text-sm text-navy-mid">
                        Your spot is reserved now. Pay at the reception on the
                        day of your visit — no upfront payment required.
                      </p>
                    </InfoBox>
                  )}

                  <div className="mt-8">
                    <button
                      type="submit"
                      className="h-12 rounded-sm bg-gold px-8 text-base font-medium text-navy transition hover:bg-gold-light md:w-auto w-full"
                    >
                      {paymentMethod === "pay_at_clinic"
                        ? "Confirm & Join Queue →"
                        : `Pay ${booking.fee} EGP & Join Queue →`}
                    </button>
                    <p className="mt-3 text-xs text-navy-mid">
                      256-bit SSL · PCI DSS compliant
                    </p>
                  </div>
                </form>
              </section>

              {/* Order summary */}
              <OrderSummary booking={booking} />
            </div>
          </>
        )}

        {/* ── Step 2: Processing ── */}
        {step === "processing" && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-gold" />
            <p className="text-navy-mid">Reserving your spot in the queue…</p>
          </div>
        )}

        {/* ── Step 3: Success (Flow 11 result) ── */}
        {step === "success" && booking && queueResult && (
          <SuccessScreen
            booking={booking}
            result={queueResult}
            onViewTicket={() =>
              navigate(`/ticket/${queueResult.appointmentId}`)
            }
          />
        )}
      </main>
    </div>
  );
}

// ── Order Summary sidebar ────────────────────────────────────────────────────

function OrderSummary({ booking }: { booking: BookingState }) {
  return (
    <aside className="h-fit rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="font-heading text-2xl font-bold text-navy">
        Order Summary
      </h2>

      <div className="mt-5 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-lg font-bold text-navy">
          {booking.doctorInitials}
        </div>
        <div>
          <p className="font-heading text-xl font-bold text-navy">
            {booking.doctorName}
          </p>
          <p className="mt-0.5 text-sm text-navy-mid">{booking.doctorTitle}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3 border-t border-border pt-5">
        <SummaryRow label="📅 Date" value={booking.date} />
        <SummaryRow label="⏰ Time" value={booking.startTime} />
        <SummaryRow label="📍 Clinic" value={booking.clinicName} />
        <SummaryRow label="👤 Patient" value={booking.patientName} />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
        <span className="text-sm font-medium text-navy-mid">Total</span>
        <span className="font-heading text-3xl font-bold text-gold">
          {booking.fee}{" "}
          <span className="font-body text-sm text-navy-mid">EGP</span>
        </span>
      </div>
    </aside>
  );
}

// ── Success Screen (Flow 11 — queue number + ETA) ────────────────────────────

type SuccessScreenProps = {
  booking: BookingState;
  result: QueueResult;
  onViewTicket: () => void;
};

function SuccessScreen({ booking, result, onViewTicket }: SuccessScreenProps) {
  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="rounded-lg border border-border bg-white p-8 text-center shadow-md">
        {/* Confirmed badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-sm font-medium text-success">
          <span className="h-2 w-2 rounded-full bg-success" />
          Booking confirmed
        </div>

        <p className="text-sm text-navy-mid">You&apos;re in the queue for</p>
        <p className="mt-1 font-heading text-2xl font-bold text-navy">
          {booking.doctorName}
        </p>
        <p className="mt-0.5 text-sm text-navy-mid">
          {booking.clinicName} · {booking.date}
        </p>

        {/* Queue number */}
        <p className="mt-8 text-sm font-medium uppercase tracking-wide text-navy-mid">
          Your queue number
        </p>
        <p className="font-heading text-9xl font-bold leading-none text-gold">
          {result.queueNumber}
        </p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-gold-tint p-4">
            <p className="font-heading text-2xl font-bold text-gold">
              ~{result.estimatedWaitMinutes}m
            </p>
            <p className="mt-1 text-xs text-navy-mid">Est. wait</p>
          </div>
          <div className="rounded-md bg-offwhite p-4">
            <p className="font-heading text-2xl font-bold text-navy">
              {booking.fee} EGP
            </p>
            <p className="mt-1 text-xs text-navy-mid">Consult fee</p>
          </div>
        </div>

        <button
          onClick={onViewTicket}
          className="mt-8 h-12 w-full rounded-sm bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
        >
          View My Live Ticket →
        </button>

        <p className="mt-4 text-xs text-navy-mid">
          A WhatsApp confirmation with your live queue link will be sent to your
          phone once the backend is connected.
        </p>
      </div>
    </div>
  );
}

// ── Card payment form ────────────────────────────────────────────────────────

function CardForm() {
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-navy">Cardholder Name *</span>
        <input
          type="text"
          placeholder="As printed on card"
          className="mt-2 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm outline-none focus:border-gold"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-navy">Card Number *</span>
        <input
          type="text"
          placeholder="0000 0000 0000 0000"
          className="mt-2 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm outline-none focus:border-gold"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-navy">Expiry *</span>
          <input
            type="text"
            placeholder="MM / YY"
            className="mt-2 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm outline-none focus:border-gold"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-navy">CVV *</span>
          <input
            type="password"
            placeholder="•••"
            className="mt-2 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm outline-none focus:border-gold"
          />
        </label>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function InfoBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-gold-tint p-5">
      <h2 className="font-heading text-xl font-bold text-navy">{title}</h2>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-navy-mid">{label}</span>
      <span className="text-right text-sm font-medium text-navy">{value}</span>
    </div>
  );
}
