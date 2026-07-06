import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { SPECIALTIES, AREAS } from "../data/mockData";
import {
  searchOrgs,
  getOrgDoctors,
  membershipToDoctor,
} from "../services/marketplaceService";
import type { Doctor } from "../types/index";

// ── Page ──────────────────────────────────────────────────────────────────────

export function Marketplace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();

  const [specialty, setSpecialty] = useState(
    searchParams.get("specialty") ?? "All Specialties",
  );
  const [area, setArea] = useState(
    searchParams.get("area") ?? "All Areas",
  );

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [orgIdByDoctor, setOrgIdByDoctor] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    let cancelled = false;
    const areaFilter = area !== "All Areas" ? area : undefined;

    searchOrgs({ city: areaFilter })
      .then(async (orgs) => {
        const perOrg = await Promise.all(
          orgs.map(async (org) => {
            const members = await getOrgDoctors(org.id);
            return members.map((m) => ({
              doctor: membershipToDoctor(m, org),
              orgId: org.id,
            }));
          }),
        );
        if (cancelled) return;
        let flat = perOrg.flat();
        if (specialty !== "All Specialties") {
          flat = flat.filter(({ doctor: d }) =>
            d.specialty.toLowerCase().includes(specialty.toLowerCase()),
          );
        }
        const idMap: Record<string, string> = {};
        flat.forEach(({ doctor, orgId }) => { idMap[doctor.id] = orgId; });
        setOrgIdByDoctor(idMap);
        setDoctors(flat.map(({ doctor }) => doctor));
      })
      .catch(() => {
        if (!cancelled) setDoctors([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
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
              {isLoading ? t("Loading…") : `${doctors.length} ${doctors.length !== 1 ? t("results") : t("result")}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 animate-fade-up">
          <p className="text-sm font-medium text-gold">
            {filterLabel ?? t("All specialties · All areas")}
          </p>
          <h1 className="font-heading text-4xl font-bold text-navy">
            {filterLabel ? `${specialty !== "All Specialties" ? specialty : t("Doctors")} in ${area !== "All Areas" ? area : t("Cairo")}` : t("All Doctors")}
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
            {doctors.map((doctor, i) => (
              <div
                key={doctor.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <DoctorCard
                  doctor={doctor}
                  onViewProfile={() =>
                    navigate(`/doctors/${doctor.id}`, {
                      state: { orgId: orgIdByDoctor[doctor.id] ?? "" },
                    })
                  }
                />
              </div>
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
  const { t } = useLanguage();
  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-gold hover:shadow-lg">
      {/* Card header */}
      <div className="flex items-start gap-4 p-5">
        {doctor.avatarUrl ? (
          <img
            src={doctor.avatarUrl}
            alt={doctor.name}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-xl font-bold text-navy">
            {doctor.initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-xl font-bold leading-tight text-navy">
              {doctor.name}
            </h3>
            {doctor.verified && (
              <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                {t("✓ Verified")}
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
              ({doctor.reviewCount} {t("reviews")})
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
          {doctor.experienceYears} {t("yrs exp")}
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
          <p className="text-xs text-navy-mid">{t("Consultation fee")}</p>
        </div>

        <button
          onClick={onViewProfile}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-white transition hover:scale-105 hover:bg-navy-mid active:scale-95"
        >
          {t("View Profile →")}
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
        <div className="shimmer h-14 w-14 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="shimmer h-5 w-3/4 rounded" />
          <div className="shimmer h-3 w-1/2 rounded" />
          <div className="shimmer h-3 w-1/3 rounded" />
          <div className="shimmer h-3 w-24 rounded" />
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-5 py-3">
        <div className="shimmer h-5 w-16 rounded-sm" />
        <div className="shimmer h-5 w-12 rounded-sm" />
        <div className="shimmer h-5 w-14 rounded-sm" />
      </div>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="shimmer h-8 w-20 rounded" />
        <div className="shimmer h-9 w-24 rounded-md" />
      </div>
    </article>
  );
}

// ── Empty results ─────────────────────────────────────────────────────────────

function EmptyResults({ onClear }: { onClear: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl bg-white py-20 text-center shadow-sm">
      <p className="text-5xl">🔍</p>
      <h3 className="mt-4 font-heading text-2xl font-bold text-navy">
        {t("No doctors found")}
      </h3>
      <p className="mt-2 text-sm text-navy-mid">
        {t("Try adjusting your filters to see more results.")}
      </p>
      <button
        onClick={onClear}
        className="mt-6 rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
      >
        {t("Clear Filters")}
      </button>
    </div>
  );
}
