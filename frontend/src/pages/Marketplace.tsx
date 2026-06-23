import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SPECIALTIES, AREAS } from "../data/mockData";
import { fetchDoctors } from "../services/mockApi";
import type { Doctor } from "../context/AppContext";

// ── Page ──────────────────────────────────────────────────────────────────────

export function Marketplace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [specialty, setSpecialty] = useState(
    searchParams.get("specialty") ?? "All Specialties",
  );
  const [area, setArea] = useState(
    searchParams.get("area") ?? "All Areas",
  );

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetchDoctors({
      specialty: specialty !== "All Specialties" ? specialty : undefined,
      area: area !== "All Areas" ? area : undefined,
    }).then((results) => {
      setDoctors(results);
      setIsLoading(false);
    });
  }, [specialty, area]);

  const filterLabel =
    specialty !== "All Specialties" || area !== "All Areas"
      ? [
          specialty !== "All Specialties" ? specialty : null,
          area !== "All Areas" ? area : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <div>
      {/* ── Sticky filter bar ── */}
      <div className="sticky top-16 z-40 border-b border-border bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold"
            >
              {SPECIALTIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold"
            >
              {AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>

            {filterLabel && (
              <button
                onClick={() => {
                  setSpecialty("All Specialties");
                  setArea("All Areas");
                }}
                className="rounded-full bg-gold-tint px-3 py-1 text-xs font-medium text-navy transition hover:bg-gold/20"
              >
                {filterLabel} ✕
              </button>
            )}

            <span className="ml-auto text-sm text-navy-mid">
              {isLoading ? "Loading…" : `${doctors.length} result${doctors.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6">
          <p className="text-sm font-medium text-gold">
            {filterLabel ?? "All specialties · All areas"}
          </p>
          <h1 className="font-heading text-4xl font-bold text-navy">
            {filterLabel ? `${specialty !== "All Specialties" ? specialty : "Doctors"} in ${area !== "All Areas" ? area : "Cairo"}` : "All Doctors"}
          </h1>
        </div>

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <DoctorCardSkeleton key={i} />
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <EmptyResults
            onClear={() => {
              setSpecialty("All Specialties");
              setArea("All Areas");
            }}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {doctors.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                onViewProfile={() => navigate(`/doctors/${doctor.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Doctor Card ───────────────────────────────────────────────────────────────

function DoctorCard({
  doctor,
  onViewProfile,
}: {
  doctor: Doctor;
  onViewProfile: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white shadow-sm transition hover:border-gold hover:shadow-md">
      {/* Card header */}
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-xl font-bold text-navy">
          {doctor.initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-xl font-bold leading-tight text-navy">
              {doctor.name}
            </h3>
            {doctor.verified && (
              <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                ✓ Verified
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-navy-mid">{doctor.title}</p>
          <p className="text-xs text-navy-mid">{doctor.organization}</p>

          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-sm text-gold">★</span>
            <span className="text-sm font-medium text-navy">
              {doctor.rating}
            </span>
            <span className="text-xs text-navy-mid">
              ({doctor.reviewCount} reviews)
            </span>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 border-t border-border px-5 py-3">
        <span className="rounded-sm bg-gold-tint px-2 py-0.5 text-xs font-medium text-navy">
          {doctor.specialty}
        </span>
        <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-navy-mid">
          {doctor.area}
        </span>
        <span className="rounded-sm bg-green-50 px-2 py-0.5 text-xs font-medium text-success">
          {doctor.availableLabel}
        </span>
        <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-navy-mid">
          {doctor.experienceYears} yrs exp
        </span>
      </div>

      {/* Fee + CTA */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-heading text-2xl font-bold text-gold">
            {doctor.fee}
            <span className="ml-1 font-body text-sm font-normal text-navy-mid">
              EGP
            </span>
          </p>
          <p className="text-xs text-navy-mid">Consultation fee</p>
        </div>

        <button
          onClick={onViewProfile}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-mid"
        >
          View Profile
        </button>
      </div>
    </article>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function DoctorCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex items-start gap-4 p-5">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-offwhite" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-offwhite" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-offwhite" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-offwhite" />
          <div className="h-3 w-24 animate-pulse rounded bg-offwhite" />
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-3">
        <div className="h-5 w-16 animate-pulse rounded-sm bg-offwhite" />
        <div className="h-5 w-12 animate-pulse rounded-sm bg-offwhite" />
        <div className="h-5 w-14 animate-pulse rounded-sm bg-offwhite" />
      </div>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="h-8 w-20 animate-pulse rounded bg-offwhite" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-offwhite" />
      </div>
    </article>
  );
}

// ── Empty results ─────────────────────────────────────────────────────────────

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl bg-white py-20 text-center shadow-sm">
      <p className="text-5xl">🔍</p>
      <h3 className="mt-4 font-heading text-2xl font-bold text-navy">
        No doctors found
      </h3>
      <p className="mt-2 text-sm text-navy-mid">
        Try adjusting your filters to see more results.
      </p>
      <button
        onClick={onClear}
        className="mt-6 rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
      >
        Clear Filters
      </button>
    </div>
  );
}
