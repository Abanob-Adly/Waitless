import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useApp } from "../context/AppContext";
import { fmt12 } from "../utils/time";
import { bookMarketplace } from "../services/appointmentService";
import { startAppointmentCheckout } from "../services/paymentService";
import type { Doctor, Session } from "../context/AppContext";
import type { ActiveBooking } from "../types/index";

type CheckoutState = {
  doctor: Doctor;
  session: Session;
  patientName: string;
  patientPhone: string;
};

const METHOD_OPTIONS: { value: "paymob" | "clinic"; icon: string; title: string; desc: string }[] = [
  {
    value: "paymob",
    icon: "💳",
    title: "Pay Online with Paymob",
    desc: "You will be redirected to Paymob's secure checkout page to complete payment. Your appointment is confirmed immediately.",
  },
  {
    value: "clinic",
    icon: "🏥",
    title: "Pay at Clinic",
    desc: "Join the queue right away and pay the consultation fee at the clinic reception. Your ticket shows as unpaid until staff confirms it.",
  },
];

export function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const { addBooking } = useApp();

  const state = location.state as CheckoutState | null;

  if (!state?.doctor || !state?.session) {
    return (
      <main className="py-24 text-center">
        <p className="text-5xl">🔒</p>
        <h2 className="mt-4 font-heading text-2xl font-bold text-navy">
          No booking in progress
        </h2>
        <p className="mt-2 text-sm text-navy-mid">
          Please select a doctor and session first.
        </p>
        <button
          onClick={() => navigate("/search")}
          className="mt-6 rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          Find a Doctor
        </button>
      </main>
    );
  }

  const { doctor, session, patientName, patientPhone } = state;

  const [paymentMethod, setPaymentMethod] = useState<"paymob" | "clinic">("paymob");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function handlePayWithPaymob() {
    setProcessing(true);
    setError(null);

    try {
      const appt = await bookMarketplace(session.id, { notes: notes.trim() || undefined });

      const { checkoutUrl } = await startAppointmentCheckout(appt.id);

      window.location.assign(checkoutUrl);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Payment initiation failed. Please try again.";
      setError(msg);
      setProcessing(false);
    }
  }

  async function handlePayAtClinic() {
    setProcessing(true);
    setError(null);

    try {
      const appt = await bookMarketplace(session.id, { paymentMethod: "clinic", notes: notes.trim() || undefined });

      const booking: ActiveBooking = {
        id: appt.id,
        doctor,
        session,
        queueNumber: appt.queueNumber,
        paymentMethod: "clinic",
        paymentStatus: "pending",
        accessToken: appt.accessToken ?? undefined,
        patientNotes: notes.trim() || undefined,
      };
      addBooking(booking);

      navigate("/payment-result", {
        state: {
          appointmentId: appt.id,
          queueNumber: appt.queueNumber,
          accessToken: appt.accessToken,
          appointmentStatus: appt.status,
          doctor,
          session,
          amount: doctor.fee,
          method: "clinic",
          patientName,
          patientPhone,
        },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to reserve your spot. Please try again.";
      setError(msg);
      setProcessing(false);
    }
  }

  async function handleSubmit() {
    if (paymentMethod === "paymob") {
      await handlePayWithPaymob();
    } else {
      await handlePayAtClinic();
    }
  }

  const methodConfig = METHOD_OPTIONS.find((m) => m.value === paymentMethod)!;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1.5 rounded-md bg-offwhite px-3 py-1.5 text-sm text-navy-mid transition hover:bg-border hover:text-navy"
      >
        ← Back
      </button>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* ── Left: payment form ── */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h1 className="font-heading text-3xl font-bold text-navy">
            Complete Payment
          </h1>
          <p className="mt-1 text-sm text-navy-mid">
            You&apos;re booking with{" "}
            <span className="font-medium text-navy">{doctor.name}</span> on{" "}
            <span className="font-medium text-navy">{session.date}</span>.
          </p>

          {/* Payment method toggle */}
          <div className="mt-6 flex gap-3">
            {METHOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPaymentMethod(opt.value)}
                className={`flex flex-1 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                  paymentMethod === opt.value
                    ? "border-gold bg-gold-tint/30"
                    : "border-border bg-white hover:border-gold/50"
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-navy">{opt.title}</p>
                  <p className="mt-0.5 text-xs text-navy-mid">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Method description card */}
          <div className="mt-6 rounded-xl border border-border bg-offwhite p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-tint">
                <span className="text-2xl">{methodConfig.icon}</span>
              </div>
              <div>
                <p className="font-heading text-lg font-bold text-navy">{methodConfig.title}</p>
                <p className="mt-1 text-sm text-navy-mid">{methodConfig.desc}</p>
              </div>
            </div>
          </div>

          {/* Optional note for the doctor */}
          <div className="mt-6">
            <label className="mb-1.5 block text-sm font-medium text-navy">
              Notes for the doctor <span className="font-normal text-navy-mid">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              dir="auto"
              placeholder="e.g. symptoms, allergies, or anything the doctor should know before your visit"
              className="w-full resize-none rounded-md border border-border px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            onClick={() => void handleSubmit()}
            disabled={processing}
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
          >
            {processing ? (
              <>
                <Spinner />
                {paymentMethod === "paymob" ? "Redirecting to Paymob…" : "Joining the queue…"}
              </>
            ) : paymentMethod === "paymob" ? (
              `Pay ${doctor.fee} EGP with Paymob →`
            ) : (
              `Join Queue & Pay at Clinic →`
            )}
          </button>

          {paymentMethod === "paymob" && (
            <p className="mt-3 text-center text-xs text-navy-mid">
              🔒 256-bit SSL · PCI DSS compliant · Powered by Paymob
            </p>
          )}
        </div>

        {/* ── Right: order summary ── */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="bg-navy px-5 py-4">
              <p className="font-heading text-base font-bold text-white">
                Order Summary
              </p>
            </div>

            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading font-bold text-navy">
                  {doctor.initials}
                </div>
                <div>
                  <p className="font-heading text-base font-bold text-navy">
                    {doctor.name}
                  </p>
                  <p className="text-xs text-navy-mid">{doctor.title}</p>
                </div>
              </div>

              <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
                <SummaryRow icon="📅" label="Date" value={session.date} />
                <SummaryRow icon="⏰" label="Time" value={fmt12(session.startTime, locale)} />
                <SummaryRow icon="📍" label="Clinic" value={session.clinicName} />
                <SummaryRow icon="📌" label="Area" value={doctor.area} />
              </dl>

              <div className="mt-4 flex items-center justify-between border-t-2 border-navy pt-4">
                <span className="font-heading text-base font-bold text-navy">Total</span>
                <span className="font-heading text-2xl font-bold text-gold">
                  {doctor.fee} EGP
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-mid">
              Booking for
            </p>
            <p className="mt-1 font-medium text-navy">{patientName}</p>
            <p className="text-sm text-navy-mid">{patientPhone}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-navy-mid">
        <span>{icon}</span>
        {label}
      </dt>
      <dd className="text-right font-medium text-navy">{value}</dd>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
