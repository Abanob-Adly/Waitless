import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { bookMarketplace } from "../services/appointmentService";
import { getMyWallet } from "../services/walletService";
import { api } from "../services/api";
import {
  validateCardNumber,
  validateExpiry,
  validateCVV,
  validatePhone,
} from "../utils/validation";
import { CardVisual, detectCardBrand } from "../components/payment/CardVisual";
import type { Doctor, Session } from "../context/AppContext";
import type { WalletInfo } from "../services/walletService";

// ── Checkout state passed via React Router location.state ─────────────────────

type CheckoutState = {
  doctor: Doctor;
  session: Session;
  patientName: string;
  patientPhone: string;
};

type PaymentMethod = "card" | "vodafone" | "clinic" | "wallet";

// ── Page ──────────────────────────────────────────────────────────────────────

export function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setBookingIntent } = useApp();

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

  // ── Wallet balance ────────────────────────────────────────────────────────
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  useEffect(() => {
    getMyWallet().then(setWalletInfo).catch(() => setWalletInfo(null));
  }, []);

  const walletSufficient = walletInfo?.status === "active" && (walletInfo?.balance ?? 0) >= (session?.fee ?? doctor?.fee ?? 0);

  // ── Payment form state ────────────────────────────────────────────────────
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Card fields
  const [cardholderName, setCardholderName] = useState(patientName);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [showCardBack, setShowCardBack] = useState(false);

  // Vodafone Cash field
  const [vodafonePhone, setVodafonePhone] = useState(patientPhone);

  const rawDigits = cardNumber.replace(/\s/g, "");
  const brand = detectCardBrand(rawDigits);

  function formatCardNumber(raw: string) {
    return raw
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  }

  function formatExpiry(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
    return digits;
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (method === "wallet") {
      if (!walletSufficient) errs.wallet = "Insufficient wallet balance.";
    } else if (method === "card") {
      if (!cardholderName.trim())
        errs.cardholderName = "Cardholder name is required.";
      const cardResult = validateCardNumber(cardNumber.replace(/\s/g, ""));
      if (!cardResult.valid) errs.cardNumber = cardResult.error;
      const expiryResult = validateExpiry(expiry);
      if (!expiryResult.valid) errs.expiry = expiryResult.error;
      const cvvResult = validateCVV(cvv);
      if (!cvvResult.valid) errs.cvv = cvvResult.error;
    } else if (method === "vodafone") {
      const phoneResult = validatePhone(vodafonePhone.trim());
      if (!phoneResult.valid) errs.vodafonePhone = phoneResult.error;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setProcessing(true);

    let appointmentId = "";
    let queueNumber = 0;
    let accessToken = "";
    try {
      const appt = await bookMarketplace(session.id);
      appointmentId = appt.id;
      queueNumber = appt.queueNumber;
      accessToken = appt.accessToken ?? "";
    } catch (err: unknown) {
      // Wallet payments need a confirmed appointment ID before charging —
      // abort and surface the error rather than silently skipping the debit.
      if (method === "wallet") {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Booking failed. Please try again.";
        setErrors({ wallet: msg });
        setProcessing(false);
        return;
      }
      // For card / clinic / vodafone: keep the original demo behaviour
      // (proceed to result page even without a real appointment ID).
    }

    // Debit the wallet now that we have a confirmed appointment
    if (method === "wallet" && appointmentId) {
      try {
        const fee = session.fee || doctor.fee;
        await api.post("/wallet/me/purchase", { appointmentId, amount: fee });
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Wallet payment failed.";
        setErrors({ wallet: msg });
        setProcessing(false);
        return;
      }
    }

    const last4 = rawDigits.length >= 4 ? rawDigits.slice(-4) : undefined;
    const success = true; // No payment gateway yet — all validated submissions succeed
    const transactionId = `TXN-${Date.now()}`;

    setBookingIntent(null);
    setProcessing(false);

    navigate("/payment-result", {
      state: {
        success,
        transactionId,
        doctor,
        session,
        amount: doctor.fee,
        method,
        last4,
        patientName,
        patientPhone,
        appointmentId,
        queueNumber,
        accessToken,
      },
    });
  }

  const walletBalance = walletInfo?.balance ?? 0;
  const methodLabels: Record<PaymentMethod, string> = {
    card: "💳  Credit / Debit",
    vodafone: "📱  Vodafone Cash",
    clinic: "🏥  Pay at Clinic",
    wallet: `👛  Wallet (${walletBalance} EGP)`,
  };

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

          {/* Payment method tab buttons */}
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["card", "vodafone", "clinic", "wallet"] as PaymentMethod[]).map((m) => {
              const isWalletDisabled = m === "wallet" && !walletSufficient;
              return (
                <button
                  key={m}
                  onClick={() => !isWalletDisabled && setMethod(m)}
                  disabled={isWalletDisabled}
                  title={isWalletDisabled ? `Insufficient balance (${walletBalance} EGP)` : undefined}
                  className={`rounded-md border py-3 text-xs font-medium transition ${
                    method === m
                      ? "border-navy bg-navy text-white"
                      : isWalletDisabled
                        ? "cursor-not-allowed border-border bg-offwhite text-navy-mid/40"
                        : "border-border bg-white text-navy-mid hover:border-navy/50 hover:text-navy"
                  }`}
                >
                  {methodLabels[m]}
                </button>
              );
            })}
          </div>

          {/* Animated card visual (card method only) */}
          {method === "card" && (
            <div className="mt-6 flex justify-center">
              <CardVisual
                cardNumber={cardNumber}
                cardholderName={cardholderName}
                expiry={expiry}
                showBack={showCardBack}
                brand={brand}
              />
            </div>
          )}

          {/* Form area */}
          <form onSubmit={handlePay} className="mt-6">
            {method === "card" && (
              <div className="space-y-4">
                <FormField
                  label="Cardholder Name *"
                  placeholder="As printed on card"
                  value={cardholderName}
                  onChange={setCardholderName}
                  error={errors.cardholderName}
                />

                <FormField
                  label="Card Number *"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(v) => setCardNumber(formatCardNumber(v))}
                  error={errors.cardNumber}
                  inputMode="numeric"
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Expiry *"
                    placeholder="MM / YY"
                    value={expiry}
                    onChange={(v) => setExpiry(formatExpiry(v))}
                    error={errors.expiry}
                    inputMode="numeric"
                  />
                  <FormField
                    label="CVV *"
                    placeholder="•••"
                    value={cvv}
                    onChange={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))}
                    error={errors.cvv}
                    inputMode="numeric"
                    type="password"
                    onFocus={() => setShowCardBack(true)}
                    onBlur={() => setShowCardBack(false)}
                  />
                </div>
              </div>
            )}

            {method === "vodafone" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
                  <p className="font-medium">Vodafone Cash Payment</p>
                  <p className="mt-1 text-xs leading-5">
                    You will receive an SMS on your registered Vodafone Cash
                    number to confirm the payment. Make sure your wallet has
                    sufficient balance.
                  </p>
                </div>

                <FormField
                  label="Vodafone Cash Number *"
                  placeholder="01XXXXXXXXX"
                  value={vodafonePhone}
                  onChange={setVodafonePhone}
                  error={errors.vodafonePhone}
                  inputMode="numeric"
                />
              </div>
            )}

            {method === "clinic" && (
              <div className="rounded-xl border border-border bg-offwhite p-5 text-sm leading-6 text-navy-mid">
                <p className="font-medium text-navy">No payment needed now.</p>
                <p className="mt-2">
                  You will pay the consultation fee of{" "}
                  <strong className="text-gold">{doctor.fee} EGP</strong> at
                  the clinic reception on the day of your appointment.
                </p>
                <p className="mt-2">
                  Please arrive at{" "}
                  <strong className="text-navy">{session.startTime}</strong> at{" "}
                  <strong className="text-navy">{session.clinicName}</strong>.
                </p>
              </div>
            )}

            {method === "wallet" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-border bg-offwhite px-5 py-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-navy-mid">Wallet Balance</p>
                    <p className="mt-0.5 font-heading text-2xl font-bold text-navy">{walletBalance} EGP</p>
                  </div>
                  <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    {walletSufficient ? "✓ Sufficient" : "Insufficient"}
                  </span>
                </div>
                {!walletSufficient && (
                  <div className="rounded-lg bg-danger/5 border border-danger/20 px-4 py-3 text-sm text-danger">
                    Your wallet balance is insufficient. Top up from the Wallet tab in your dashboard.
                  </div>
                )}
                {errors.wallet && (
                  <p className="text-sm text-danger">{errors.wallet}</p>
                )}
              </div>
            )}

            {/* Pay button */}
            <button
              type="submit"
              disabled={processing}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
            >
              {processing ? (
                <>
                  <Spinner />
                  Processing…
                </>
              ) : method === "clinic" ? (
                "Confirm Booking →"
              ) : method === "wallet" ? (
                `Pay ${session.fee || doctor.fee} EGP from Wallet →`
              ) : (
                `Pay ${doctor.fee} EGP →`
              )}
            </button>

            {/* Security badge */}
            {method === "card" && (
              <p className="mt-3 text-center text-xs text-navy-mid">
                🔒 256-bit SSL · PCI DSS compliant
              </p>
            )}
          </form>
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
              {/* Doctor */}
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

              {/* Details */}
              <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
                <SummaryRow icon="📅" label="Date" value={session.date} />
                <SummaryRow icon="⏰" label="Time" value={session.startTime} />
                <SummaryRow
                  icon="📍"
                  label="Clinic"
                  value={session.clinicName}
                />
                <SummaryRow icon="📌" label="Area" value={doctor.area} />
              </dl>

              {/* Total */}
              <div className="mt-4 flex items-center justify-between border-t-2 border-navy pt-4">
                <span className="font-heading text-base font-bold text-navy">
                  Total
                </span>
                <span className="font-heading text-2xl font-bold text-gold">
                  {doctor.fee} EGP
                </span>
              </div>
            </div>
          </div>

          {/* Patient details recap */}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function FormField({
  label,
  placeholder,
  value,
  onChange,
  error,
  inputMode,
  type = "text",
  onFocus,
  onBlur,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`mt-1.5 h-12 w-full rounded-md border bg-white px-4 text-sm text-navy outline-none transition focus:ring-2 ${
          error
            ? "border-danger focus:ring-danger/20"
            : "border-border focus:border-gold focus:ring-gold/20"
        }`}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
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
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
