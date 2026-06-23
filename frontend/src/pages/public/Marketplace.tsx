import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { mockDoctors } from "../../data/mockDoctors";
import type { Doctor } from "../../types/doctor";

const SPECIALTIES = [
  "All Specialties",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Orthopedics",
];

const AREAS = ["All Areas", "Maadi", "Heliopolis", "Nasr City", "New Cairo"];

const STATS = [
  { value: "50K+", label: "Patients Served" },
  { value: "1,200+", label: "Verified Doctors" },
  { value: "98%", label: "Satisfaction" },
  { value: "35+", label: "Specialties" },
];

export function Marketplace() {
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState("All Specialties");
  const [area, setArea] = useState("All Areas");

  const filtered = mockDoctors.filter((d) => {
    const matchSpecialty =
      specialty === "All Specialties" || d.specialty === specialty;
    const matchArea = area === "All Areas" || d.area === area;
    return matchSpecialty && matchArea;
  });

  return (
    <div className="min-h-screen bg-offwhite">
      <Navbar />

      {/* ── Hero ── */}
      <section className="bg-navy">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80">
            Egypt&apos;s #1 Healthcare Booking Platform
          </span>

          <h1 className="mt-5 font-heading text-5xl font-bold leading-tight text-white md:text-6xl">
            Book Your Doctor.{" "}
            <span className="text-gold">Skip the Wait.</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg text-white/70">
            Find, compare and book appointments with Egypt&apos;s top
            specialists — online, instantly, no phone calls.
          </p>

          {/* Search bar */}
          <div className="mt-8 max-w-2xl rounded-lg bg-white p-4 shadow-xl">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="h-12 rounded-sm border border-border px-4 text-sm text-navy outline-none focus:border-gold"
              >
                {SPECIALTIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="h-12 rounded-sm border border-border px-4 text-sm text-navy outline-none focus:border-gold"
              >
                {AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>

              <button className="h-12 rounded-sm bg-gold px-6 text-sm font-medium text-navy transition hover:bg-gold-light">
                Search Doctors
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
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
      </section>

      {/* ── Doctor grid ── */}
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
          <span className="text-sm text-navy-mid">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-white py-16 text-center">
            <p className="text-navy-mid">
              No doctors found matching your search.
            </p>
            <button
              onClick={() => {
                setSpecialty("All Specialties");
                setArea("All Areas");
              }}
              className="mt-4 text-sm font-medium text-gold hover:text-gold-light"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {filtered.map((doctor) => (
              <MarketplaceCard
                key={doctor.id}
                doctor={doctor}
                onViewProfile={() => navigate(`/doctors/${doctor.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Marketplace Doctor Card ──────────────────────────────────────────────────
// Separate from the shared DoctorCard so the whole article is clickable.

type MarketplaceCardProps = {
  doctor: Doctor;
  onViewProfile: () => void;
};

function MarketplaceCard({ doctor, onViewProfile }: MarketplaceCardProps) {
  return (
    <article
      onClick={onViewProfile}
      className="cursor-pointer rounded-md border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-lg font-bold text-navy">
          {doctor.initials}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl font-bold text-navy">
            {doctor.fullName}
          </h3>
          <p className="mt-1 text-sm text-navy-mid">{doctor.title}</p>

          {/* Stars + rating */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gold">★★★★★</span>
            <span className="font-medium text-navy">{doctor.rating}</span>
            <span className="text-navy-mid">({doctor.reviewsCount})</span>
          </div>

          {/* Badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-sm bg-gold-tint px-2 py-1 text-xs font-medium text-navy">
              {doctor.specialty}
            </span>
            <span className="rounded-sm bg-green-50 px-2 py-1 text-xs font-medium text-success">
              {doctor.availableLabel}
            </span>
            <span className="rounded-sm border border-border px-2 py-1 text-xs text-navy-mid">
              {doctor.area}
            </span>
          </div>

          {/* Fee + CTA */}
          <div className="mt-4 flex items-center justify-between">
            <p className="font-heading text-2xl font-bold text-gold">
              {doctor.consultationFee}
              <span className="ml-1 font-body text-sm font-medium text-navy-mid">
                EGP
              </span>
            </p>

            <span className="rounded-sm bg-gold px-3 py-1.5 text-sm font-medium text-navy transition hover:bg-gold-light">
              View Profile
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
