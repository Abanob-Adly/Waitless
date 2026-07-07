import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getPaymentResult } from "../services/paymentService";
import type { PaymentResultData } from "../services/paymentService";
import { useLanguage } from "../context/LanguageContext";

const POLL_TIMEOUT_MS = 30_000;

export function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const paymobSuccess = searchParams.get("success");
  const [status, setStatus] = useState<"loading" | "success" | "failed" | "timeout">("loading");
  const [payment, setPayment] = useState<PaymentResultData | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paymentId = searchParams.get("paymentId");

  useEffect(() => {
    if (!paymentId) {
      setStatus("failed");
      return;
    }

    async function check() {
      try {
        const result = await getPaymentResult(paymentId!);
        setPayment(result);

        if (result.status === "success") {
          setStatus("success");
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        } else if (result.status === "failed") {
          setStatus("failed");
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      } catch {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setStatus("timeout");
      }
    }

    void check();
    pollingRef.current = setInterval(check, 2000);
    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (paymobSuccess === "true") {
        setStatus("success");
      } else {
        setStatus("timeout");
      }
    }, POLL_TIMEOUT_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [paymentId, paymobSuccess]);

  const amount = payment ? (payment.amountCents / 100).toLocaleString() : "—";
  const currency = payment?.currency ?? "EGP";

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        <h1 className="font-heading text-2xl font-bold text-navy">Processing Payment</h1>
        <p className="mt-2 text-sm text-navy-mid">
          Please wait while we confirm your payment with Paymob…
        </p>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
          <svg className="h-12 w-12 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="mt-6 font-heading text-3xl font-bold text-navy">
          Payment Successful!
        </h1>
        <p className="mt-2 text-sm text-navy-mid">
          {payment?.purpose === "subscription"
            ? "Your subscription has been activated."
            : "Your appointment is confirmed."}
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-white text-left shadow-sm">
          <div className="bg-navy px-5 py-4">
            <p className="font-heading text-base font-bold text-white">Payment Receipt</p>
          </div>
          <div className="p-5 text-sm">
            <dl className="space-y-3">
              <ReceiptRow label="Payment ID" value={payment?.id ?? "—"} mono />
              <ReceiptRow label="Amount" value={`${amount} ${currency}`} />
              <ReceiptRow label="Purpose" value={payment?.purpose ?? "—"} />
              <ReceiptRow label="Status" value={payment?.status ?? "—"} />
            </dl>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => navigate(payment?.purpose === "subscription" ? "/admin?tab=billing" : "/ticket")}
            className="h-13 w-full rounded-md bg-gold py-3 text-base font-medium text-navy transition hover:bg-gold-light"
          >
            {payment?.purpose === "subscription" ? "Back to Billing" : "View My Ticket →"}
          </button>
        </div>
      </main>
    );
  }

  if (status === "timeout") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-12 w-12 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="mt-6 font-heading text-2xl font-bold text-navy">
          Payment Confirmation Pending
        </h1>
        <p className="mt-2 text-sm text-navy-mid">
          Your payment was received by Paymob but we are still waiting for final confirmation.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={async () => {
              if (!paymentId) return;
              try {
                const result = await getPaymentResult(paymentId);
                setPayment(result);
                if (result.status === "success") setStatus("success");
                else if (result.status === "failed") setStatus("failed");
              } catch {
                setStatus("timeout");
              }
            }}
            className="h-13 w-full rounded-md bg-gold py-3 text-base font-medium text-navy transition hover:bg-gold-light"
          >
            Check Status Again
          </button>
          <button
            onClick={() => navigate("/")}
            className="h-13 w-full rounded-md border border-border bg-white py-3 text-base font-medium text-navy transition hover:bg-offwhite"
          >
            Go to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-danger/10">
        <svg className="h-12 w-12 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <h1 className="mt-6 font-heading text-3xl font-bold text-navy">
        Payment Failed
      </h1>
      <p className="mt-2 text-sm text-navy-mid">
        {payment?.failureReason ?? "Something went wrong with your payment."}
      </p>

      <div className="mt-6 space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="h-13 w-full rounded-md bg-gold py-3 text-base font-medium text-navy transition hover:bg-gold-light"
        >
          Try Again →
        </button>
      </div>
    </main>
  );
}

function ReceiptRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-navy-mid">{label}</dt>
      <dd className={`text-right font-medium text-navy ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
