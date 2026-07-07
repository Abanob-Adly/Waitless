import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { Button } from "../../components/ui/Button";
import { mockBooking } from "../../data/mockBooking";

export function PaymentPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  function handlePaymobRedirect() {
    setProcessing(true);
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
              Your appointment will be confirmed after payment via Paymob.
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
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Button size="lg" className="w-full md:w-auto" onClick={handlePaymobRedirect} disabled={processing}>
                {processing ? "Redirecting…" : `Pay ${mockBooking.total} EGP with Paymob →`}
              </Button>

              <p className="mt-3 text-xs text-navy-mid">
                256-bit SSL · PCI DSS compliant · Powered by Paymob
              </p>
            </div>
          </section>

          <OrderSummary />
        </div>
      </main>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-navy-mid">{label}</span>
      <span className="text-right text-sm font-medium text-navy">{value}</span>
    </div>
  );
}
