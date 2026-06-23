import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { Button } from "../../components/ui/Button";
import { mockBooking } from "../../data/mockBooking";
import type { PaymentMethod } from "../../types/booking";

export function PaymentPage() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const navigate = useNavigate();

  function handlePaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // مؤقتًا لحد ما نعمل backend integration
    navigate(`/ticket/${mockBooking.id}`);
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <Link
          to="/doctors/layla-hassan"
          className="text-sm font-medium text-navy-mid hover:text-gold"
        >
          ← Back to booking
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
            <h1 className="font-heading text-4xl font-bold text-navy">
              Complete Payment
            </h1>

            <p className="mt-2 text-navy-mid">
              Choose your preferred payment method and confirm your booking.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <PaymentMethodButton
                active={paymentMethod === "card"}
                label="💳 Credit/Debit"
                onClick={() => setPaymentMethod("card")}
              />

              <PaymentMethodButton
                active={paymentMethod === "vodafone_cash"}
                label="📱 Vodafone Cash"
                onClick={() => setPaymentMethod("vodafone_cash")}
              />

              <PaymentMethodButton
                active={paymentMethod === "pay_at_clinic"}
                label="🏥 Pay at Clinic"
                onClick={() => setPaymentMethod("pay_at_clinic")}
              />
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-8">
              {paymentMethod === "card" && <CardPaymentForm />}

              {paymentMethod === "vodafone_cash" && (
                <div className="rounded-md border border-border bg-gold-tint p-5">
                  <h2 className="font-heading text-2xl font-bold text-navy">
                    Vodafone Cash
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-navy-mid">
                    Enter your Vodafone Cash number. Payment confirmation will
                    be handled later when we connect the real payment provider.
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
                </div>
              )}

              {paymentMethod === "pay_at_clinic" && (
                <div className="rounded-md border border-border bg-gold-tint p-5">
                  <h2 className="font-heading text-2xl font-bold text-navy">
                    Pay at Clinic
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-navy-mid">
                    Your appointment will be reserved and payment will be made
                    at the clinic reception.
                  </p>
                </div>
              )}

              <div className="mt-8">
                <Button size="lg" className="w-full md:w-auto">
                  {paymentMethod === "pay_at_clinic"
                    ? "Confirm Booking"
                    : `Pay ${mockBooking.total} EGP`}
                </Button>

                <p className="mt-3 text-xs text-navy-mid">
                  256-bit SSL · PCI DSS compliant
                </p>
              </div>
            </form>
          </section>

          <OrderSummary />
        </div>
      </main>
    </div>
  );
}

type PaymentMethodButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function PaymentMethodButton({
  label,
  active,
  onClick,
}: PaymentMethodButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md border border-gold bg-gold-tint px-4 py-3 text-left text-sm font-medium text-navy"
          : "rounded-md border border-border bg-white px-4 py-3 text-left text-sm font-medium text-navy-mid transition hover:border-gold hover:text-navy"
      }
    >
      {label}
    </button>
  );
}

function CardPaymentForm() {
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

function OrderSummary() {
  return (
    <aside className="h-fit rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="font-heading text-2xl font-bold text-navy">
        Order Summary
      </h2>

      <div className="mt-6 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-tint font-heading text-lg font-bold text-navy">
          {mockBooking.doctorInitials}
        </div>

        <div>
          <h3 className="font-heading text-xl font-bold text-navy">
            {mockBooking.doctorName}
          </h3>
          <p className="mt-1 text-sm text-navy-mid">
            {mockBooking.doctorTitle}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 border-t border-border pt-6">
        <SummaryRow label="📅 Date" value={mockBooking.date} />
        <SummaryRow label="⏰ Time" value={mockBooking.time} />
        <SummaryRow label="📍 Clinic" value={mockBooking.clinicName} />
        <SummaryRow label="📌 Area" value={mockBooking.area} />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
        <span className="text-sm font-medium text-navy-mid">Total</span>
        <span className="font-heading text-3xl font-bold text-gold">
          {mockBooking.total}{" "}
          <span className="font-body text-sm text-navy-mid">EGP</span>
        </span>
      </div>
    </aside>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-navy-mid">{label}</span>
      <span className="text-right text-sm font-medium text-navy">{value}</span>
    </div>
  );
}
