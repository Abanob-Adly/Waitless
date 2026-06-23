import { useState } from "react";
import type { Doctor } from "../../App";

// ── Mock data ─────────────────────────────────────────────────────────────────

const DOCTORS: Doctor[] = [
  {
    id: 1,
    initials: "LH",
    name: "Dr. Layla Hassan",
    specialty: "Cardiology",
    fee: 350,
    area: "Maadi",
    rating: 4.9,
  },
  {
    id: 2,
    initials: "OF",
    name: "Dr. Omar Farouk",
    specialty: "Dermatology",
    fee: 250,
    area: "Heliopolis",
    rating: 4.8,
  },
  {
    id: 3,
    initials: "SM",
    name: "Dr. Sara Mostafa",
    specialty: "Pediatrics",
    fee: 200,
    area: "Nasr City",
    rating: 4.9,
  },
  {
    id: 4,
    initials: "AK",
    name: "Dr. Amr Khalil",
    specialty: "Orthopedics",
    fee: 400,
    area: "New Cairo",
    rating: 4.7,
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

type MarketplaceProps = {
  onBook: (doctor: Doctor, data: { name: string; phone: string }) => void;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export function Marketplace({ onBook }: MarketplaceProps) {
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!formName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!formPhone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    onBook(bookingDoctor!, {
      name: formName.trim(),
      phone: formPhone.trim(),
    });
    closeModal();
  }

  function closeModal() {
    setBookingDoctor(null);
    setFormName("");
    setFormPhone("");
    setError("");
  }

  return (
    <>
      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Section header */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gold">
            Highly rated — available now
          </p>
          <h1 className="font-heading text-4xl font-bold text-navy">
            Find Your Doctor
          </h1>
        </div>

        {/* Doctor grid */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {DOCTORS.map((doc) => (
            <DoctorCard
              key={doc.id}
              doctor={doc}
              onBook={() => setBookingDoctor(doc)}
            />
          ))}
        </div>
      </main>

      {/* Booking Modal */}
      {bookingDoctor && (
        <BookingModal
          doctor={bookingDoctor}
          formName={formName}
          formPhone={formPhone}
          error={error}
          onNameChange={setFormName}
          onPhoneChange={setFormPhone}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </>
  );
}

// ── Doctor Card ───────────────────────────────────────────────────────────────

function DoctorCard({
  doctor,
  onBook,
}: {
  doctor: Doctor;
  onBook: () => void;
}) {
  const stars = "★".repeat(Math.floor(doctor.rating));

  return (
    <article className="rounded-md border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
      {/* Avatar + meta */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-lg font-bold text-navy">
          {doctor.initials}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl font-bold leading-tight text-navy">
            {doctor.name}
          </h3>
          <p className="mt-0.5 text-sm text-navy-mid">{doctor.specialty}</p>

          {/* Stars */}
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span className="text-gold">{stars}</span>
            <span className="font-medium text-navy">{doctor.rating}</span>
          </div>

          {/* Badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-sm bg-gold-tint px-2 py-1 text-xs font-medium text-navy">
              {doctor.specialty}
            </span>
            <span className="rounded-sm border border-border px-2 py-1 text-xs text-navy-mid">
              {doctor.area}
            </span>
          </div>
        </div>
      </div>

      {/* Fee + CTA */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <p className="font-heading text-2xl font-bold text-gold">
          {doctor.fee}
          <span className="ml-1 font-body text-sm font-medium text-navy-mid">
            EGP
          </span>
        </p>

        <button
          onClick={onBook}
          className="h-9 rounded-sm bg-gold px-4 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          Book
        </button>
      </div>
    </article>
  );
}

// ── Booking Modal (Flow 8 — Name + Phone only) ────────────────────────────────

type BookingModalProps = {
  doctor: Doctor;
  formName: string;
  formPhone: string;
  error: string;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
};

function BookingModal({
  doctor,
  formName,
  formPhone,
  error,
  onNameChange,
  onPhoneChange,
  onSubmit,
  onClose,
}: BookingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-2xl">
        {/* Navy header */}
        <div className="bg-navy px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading font-bold text-navy">
              {doctor.initials}
            </div>
            <div>
              <p className="font-heading text-lg font-bold text-white">
                {doctor.name}
              </p>
              <p className="text-xs text-white/60">
                {doctor.specialty} · {doctor.fee} EGP
              </p>
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-white/60 transition hover:text-white"
        >
          ✕
        </button>

        {/* Form */}
        <div className="p-6">
          <h2 className="font-heading text-2xl font-bold text-navy">
            Confirm Booking
          </h2>
          <p className="mt-1 text-sm text-navy-mid">
            Enter your details to join the queue.
          </p>

          {/* Error */}
          {error && (
            <p className="mt-4 rounded-sm bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-navy">
                Full Name *
              </span>
              <input
                type="text"
                placeholder="Ahmed Mohamed"
                value={formName}
                onChange={(e) => onNameChange(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold"
                autoFocus
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-navy">
                Phone Number *
              </span>
              <input
                type="tel"
                placeholder="01XXXXXXXXX"
                value={formPhone}
                onChange={(e) => onPhoneChange(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold"
              />
            </label>

            {/* Session info pill */}
            <div className="rounded-md bg-gold-tint px-4 py-3">
              <p className="text-xs font-medium text-navy-mid">
                You will be assigned a queue number immediately after confirming.
              </p>
            </div>

            <button
              type="submit"
              className="h-12 w-full rounded-sm bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
            >
              Join Queue →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
