import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MOCK_DOCTORS, SPECIALTIES, AREAS } from "../data/mockData";
import type { Doctor } from "../context/AppContext";

const STATS = [
  { value: "50K+", label: "Patients Served" },
  { value: "1,200+", label: "Verified Doctors" },
  { value: "98%", label: "Satisfaction" },
  { value: "35+", label: "Specialties" },
];

const STEPS = [
  {
    num: "01",
    icon: "🔍",
    title: "Search & Find",
    desc: "Browse top-rated specialists by specialty, area, and real-time availability — all in one place.",
  },
  {
    num: "02",
    icon: "📅",
    title: "Book Online",
    desc: "Select a session that fits your schedule and confirm your spot in seconds. No phone calls needed.",
  },
  {
    num: "03",
    icon: "📱",
    title: "Track Your Queue",
    desc: "Get a live digital ticket and watch your position update in real-time from anywhere.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState("All Specialties");
  const [area, setArea] = useState("All Areas");

  function handleSearch() {
    const params = new URLSearchParams();
    if (specialty !== "All Specialties") params.set("specialty", specialty);
    if (area !== "All Areas") params.set("area", area);
    navigate(`/search?${params.toString()}`);
  }

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden bg-navy">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_360px]">
            {/* Left */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                Egypt&apos;s #1 Healthcare Booking Platform
              </span>

              <h1 className="mt-5 font-heading leading-tight text-white">
                <span className="block text-5xl font-bold md:text-6xl">
                  Book Your Doctor.
                </span>
                <span className="block text-5xl font-bold text-gold md:text-6xl">
                  Skip the Wait.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-7 text-white/70">
                Find, compare and book appointments with Egypt&apos;s top
                specialists — online, instantly, no phone calls.
              </p>

              {/* Search widget */}
              <div className="mt-8 max-w-2xl rounded-xl bg-white p-4 shadow-2xl">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="h-12 rounded-md border border-border px-4 text-sm text-navy outline-none transition focus:border-gold"
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>

                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="h-12 rounded-md border border-border px-4 text-sm text-navy outline-none transition focus:border-gold"
                  >
                    {AREAS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleSearch}
                    className="h-12 rounded-md bg-gold px-6 text-sm font-medium text-navy transition hover:bg-gold-light"
                  >
                    Search Doctors
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-6 md:grid-cols-4">
                {STATS.map(({ value, label }) => (
                  <div key={label}>
                    <p className="font-heading text-3xl font-bold text-gold">
                      {value}
                    </p>
                    <p className="mt-1 text-sm text-white/60">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — decorative live-ticket preview */}
            <div className="hidden lg:block">
              <TicketPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Top Specialists ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-gold">
              Highly rated — available now
            </p>
            <h2 className="font-heading text-4xl font-bold text-navy">
              Top Specialists
            </h2>
          </div>
          <button
            onClick={() => navigate("/search")}
            className="text-sm font-medium text-navy transition hover:text-gold"
          >
            View all →
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {MOCK_DOCTORS.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="bg-navy py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-sm font-medium text-gold">
            Simple &amp; Transparent
          </p>
          <h2 className="mt-2 font-heading text-4xl font-bold text-white">
            How It Works
          </h2>
          <p className="mt-3 text-white/60">
            Three easy steps to skip the waiting room forever.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="rounded-xl bg-white/5 p-7 text-left"
              >
                <span className="font-heading text-4xl font-bold text-gold/30">
                  {step.num}
                </span>
                <div className="mt-4 text-3xl">{step.icon}</div>
                <h3 className="mt-3 font-heading text-xl font-bold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-gold-tint px-8 py-10 sm:flex-row">
          <div>
            <h3 className="font-heading text-2xl font-bold text-navy">
              Ready to skip the wait?
            </h3>
            <p className="mt-1 text-sm text-navy-mid">
              Join 50,000+ patients who book smarter every day.
            </p>
          </div>
          <button
            onClick={() => navigate("/search")}
            className="shrink-0 rounded-md bg-navy px-8 py-3 text-sm font-medium text-white transition hover:bg-navy-mid"
          >
            Find Your Doctor →
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Decorative ticket widget (hero right column) ──────────────────────────────

function TicketPreview() {
  return (
    <div className="w-full rounded-2xl border border-white/15 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50">Live queue preview</p>
          <p className="font-heading text-lg font-bold text-white">
            Your live ticket
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-medium text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>
      </div>

      <div className="rounded-xl bg-navy-mid p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading font-bold text-navy">
            LH
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Dr. Layla Hassan
            </p>
            <p className="text-xs text-white/50">Cardiology · Maadi</p>
          </div>
        </div>

        <div className="relative mx-auto my-5 flex h-36 w-36 items-center justify-center">
          <svg
            className="absolute inset-0 -rotate-90"
            viewBox="0 0 144 144"
            aria-hidden="true"
          >
            <circle cx="72" cy="72" r="60" fill="none" stroke="#DDD8CC" strokeWidth="6" />
            <circle
              cx="72"
              cy="72"
              r="60"
              fill="none"
              stroke="#C9922A"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="376.99"
              strokeDashoffset="188.5"
            />
          </svg>
          <div className="text-center">
            <span className="font-heading text-5xl font-bold leading-none text-white">
              3
            </span>
            <p className="text-xs text-white/50">position</p>
          </div>
        </div>

        <p className="mb-3 text-center text-xs text-white/50">
          Currently serving{" "}
          <span className="font-semibold text-white">#2</span>
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/10 p-2.5 text-center">
            <p className="font-heading text-xl font-bold text-gold">~36m</p>
            <p className="text-xs text-white/50">Est. wait</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2.5 text-center">
            <p className="font-heading text-xl font-bold text-white">
              350 EGP
            </p>
            <p className="text-xs text-white/50">Fee</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Doctor Card ───────────────────────────────────────────────────────────────

function DoctorCard({ doctor }: { doctor: Doctor }) {
  const navigate = useNavigate();

  return (
    <article
      onClick={() => navigate(`/doctors/${doctor.id}`)}
      className="cursor-pointer rounded-xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-lg font-bold text-navy">
          {doctor.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg font-bold leading-tight text-navy">
            {doctor.name}
          </h3>
          <p className="mt-0.5 text-xs text-navy-mid">{doctor.title}</p>
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            <span className="text-gold">★</span>
            <span className="font-medium text-navy">{doctor.rating}</span>
            <span className="text-xs text-navy-mid">({doctor.reviewCount})</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-gold-tint px-2 py-0.5 text-xs font-medium text-navy">
          {doctor.specialty}
        </span>
        <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-success">
          {doctor.availableLabel}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <p className="font-heading text-2xl font-bold text-gold">
          {doctor.fee}
          <span className="ml-1 font-body text-sm font-normal text-navy-mid">
            EGP
          </span>
        </p>
        <span className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white">
          View Profile
        </span>
      </div>
    </article>
  );
}
