import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { Doctor, Session, ActiveBooking } from "../context/AppContext";

// ── State shape passed from PaymentPage via navigate ──────────────────────────

type PaymentResultState = {
  success: boolean;
  transactionId?: string;
  error?: string;
  doctor: Doctor;
  session: Session;
  amount: number;
  method: "card" | "vodafone" | "clinic" | "wallet";
  last4?: string;
  patientName: string;
  patientPhone: string;
  appointmentId: string;
  queueNumber: number;
  accessToken?: string;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function PaymentResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addBooking } = useApp();

  const state = location.state as PaymentResultState | null;

  if (!state?.doctor) {
    navigate("/search", { replace: true });
    return null;
  }

  if (state.success) {
    return (
      <SuccessView
        state={state}
        onViewTicket={() => {
          const booking: ActiveBooking = {
            id: state.appointmentId,
            doctor: state.doctor,
            session: state.session,
            queueNumber: state.queueNumber,
            paymentMethod: state.method,
            paymentStatus: "success",
            transactionId: state.transactionId,
            last4: state.last4,
            accessToken: state.accessToken,
          };
          addBooking(booking);
          navigate("/ticket");
        }}
      />
    );
  }

  return <FailureView state={state} />;
}

// ── Success view ──────────────────────────────────────────────────────────────

function SuccessView({
  state,
  onViewTicket,
}: {
  state: PaymentResultState;
  onViewTicket: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      {/* Check icon */}
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
        <svg
          className="h-12 w-12 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h1 className="mt-6 font-heading text-3xl font-bold text-navy">
        Payment Successful!
      </h1>
      <p className="mt-2 text-sm text-navy-mid">
        Your appointment is confirmed. You are in the queue.
      </p>

      {/* Receipt card */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-white text-left shadow-sm">
        <div className="bg-navy px-5 py-4">
          <p className="font-heading text-base font-bold text-white">
            Booking Receipt
          </p>
        </div>
        <div className="p-5 text-sm">
          <dl className="space-y-3">
            <ReceiptRow label="Transaction ID" value={state.transactionId ?? "—"} mono />
            <ReceiptRow label="Doctor" value={state.doctor.name} />
            <ReceiptRow label="Date" value={state.session.date} />
            <ReceiptRow label="Time" value={state.session.startTime} />
            <ReceiptRow label="Clinic" value={state.session.clinicName} />
            <ReceiptRow label="Patient" value={state.patientName} />
            {state.last4 && (
              <ReceiptRow label="Card" value={`•••• ${state.last4}`} />
            )}
          </dl>

          {/* Total */}
          <div className="mt-4 flex items-center justify-between border-t-2 border-navy pt-4">
            <span className="font-heading font-bold text-navy">Total Paid</span>
            <span className="font-heading text-2xl font-bold text-gold">
              {state.amount} EGP
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-3">
        <button
          onClick={onViewTicket}
          className="h-13 w-full rounded-md bg-gold py-3 text-base font-medium text-navy transition hover:bg-gold-light"
        >
          View My Live Ticket →
        </button>
        <button
          onClick={() => window.print()}
          className="w-full text-center text-sm text-navy-mid transition hover:text-navy"
        >
          Download Receipt
        </button>
      </div>
    </main>
  );
}

// ── Failure view ──────────────────────────────────────────────────────────────

function FailureView({ state }: { state: PaymentResultState }) {
  const navigate = useNavigate();
  const { addBooking } = useApp();
  const [retrying, setRetrying] = useState(false);

  async function handlePayAtClinic() {
    setRetrying(true);
    const booking: ActiveBooking = {
      id: state.appointmentId,
      doctor: state.doctor,
      session: state.session,
      queueNumber: state.queueNumber,
      paymentMethod: "clinic",
      paymentStatus: "success",
    };
    addBooking(booking);
    navigate("/ticket");
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      {/* X icon */}
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-danger/10">
        <svg
          className="h-12 w-12 text-danger"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>

      <h1 className="mt-6 font-heading text-3xl font-bold text-navy">
        Payment Failed
      </h1>
      <p className="mt-2 text-sm text-navy-mid">
        {state.error ?? "Something went wrong with your payment."}
      </p>

      {/* Context card */}
      <div className="mt-8 rounded-xl border border-border bg-white p-5 text-left text-sm">
        <dl className="space-y-2.5">
          <ReceiptRow label="Doctor" value={state.doctor.name} />
          <ReceiptRow label="Date" value={state.session.date} />
          <ReceiptRow label="Amount" value={`${state.amount} EGP`} />
        </dl>
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="h-13 w-full rounded-md bg-gold py-3 text-base font-medium text-navy transition hover:bg-gold-light"
        >
          Try Again →
        </button>
        <button
          onClick={handlePayAtClinic}
          disabled={retrying}
          className="w-full rounded-md border border-border py-3 text-sm font-medium text-navy-mid transition hover:border-navy hover:text-navy disabled:opacity-50"
        >
          {retrying ? "Confirming…" : "Pay at Clinic Instead"}
        </button>
      </div>
    </main>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function ReceiptRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-navy-mid">{label}</dt>
      <dd className={`text-right font-medium text-navy ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
