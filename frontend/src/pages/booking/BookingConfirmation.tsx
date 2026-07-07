import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { useLanguage } from "../../context/LanguageContext";
import { fmt12 } from "../../utils/time";

// ── Types ────────────────────────────────────────────────────────────────────

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
  const [queueResult, setQueueResult] = useState<QueueResult | null>(null);

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
        {step === "confirm" && booking && (
          <>
            <Link
              to={`/doctors/${booking.doctorId}`}
              className="text-sm font-medium text-navy-mid hover:text-gold"
            >
              ← Back to doctor profile
            </Link>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
              <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
                <h1 className="font-heading text-4xl font-bold text-navy">
                  Complete Payment
                </h1>
                <p className="mt-2 text-navy-mid">
                  Pay with Paymob to confirm your booking.
                </p>

                <div className="mt-8 rounded-xl border border-border bg-offwhite p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-tint">
                      <span className="text-2xl">💳</span>
                    </div>
                    <div>
                      <p className="font-heading text-lg font-bold text-navy">Pay with Paymob</p>
                      <p className="mt-1 text-sm text-navy-mid">
                        You will be redirected to Paymob&apos;s secure checkout page to complete payment.
                        Your spot is reserved after successful payment.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleConfirm} className="mt-8">
                  <button
                    type="submit"
                    className="h-12 rounded-sm bg-gold px-8 text-base font-medium text-navy transition hover:bg-gold-light md:w-auto w-full"
                  >
                    Pay {booking.fee} EGP with Paymob →
                  </button>
                  <p className="mt-3 text-xs text-navy-mid">
                    256-bit SSL · PCI DSS compliant · Powered by Paymob
                  </p>
                </form>
              </section>

              <OrderSummary booking={booking} />
            </div>
          </>
        )}

        {step === "processing" && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-gold" />
            <p className="text-navy-mid">Reserving your spot in the queue…</p>
          </div>
        )}

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

function OrderSummary({ booking }: { booking: BookingState }) {
  const { locale } = useLanguage();
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
        <SummaryRow label="⏰ Time" value={fmt12(booking.startTime, locale)} />
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

function SuccessScreen({ booking, result, onViewTicket }: { booking: BookingState; result: QueueResult; onViewTicket: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="rounded-lg border border-border bg-white p-8 text-center shadow-md">
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

        <p className="mt-8 text-sm font-medium uppercase tracking-wide text-navy-mid">
          Your queue number
        </p>
        <p className="font-heading text-9xl font-bold leading-none text-gold">
          {result.queueNumber}
        </p>

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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-navy-mid">{label}</span>
      <span className="text-right text-sm font-medium text-navy">{value}</span>
    </div>
  );
}
