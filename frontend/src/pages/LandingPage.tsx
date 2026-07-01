import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../context/LanguageContext";
import { SPECIALTIES, AREAS } from "../data/mockData";
import type { Doctor, ActiveBooking } from "../context/AppContext";
import * as marketplaceService from "../services/marketplaceService";

const STATS = [
  { value: "2,400+", label: "Patients Served" },
  { value: "80+", label: "Verified Doctors" },
  { value: "4.8 / 5", label: "Average Rating" },
  { value: "18+", label: "Specialties" },
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
  const { authUser } = useAuth();
  const { bookings } = useApp();
  const { t } = useLanguage();
  const [specialty, setSpecialty] = useState("All Specialties");
  const [area, setArea] = useState("All Areas");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadMarketplace() {
      try {
        const orgs = await marketplaceService.searchOrgs({ limit: 2 });
        if (cancelled || !orgs.length) { setLoadingDoctors(false); return; }

        const results: Doctor[] = [];
        for (const orgSummary of orgs) {
          const [org, memberships] = await Promise.all([
            marketplaceService.getMarketplaceOrg(orgSummary.id),
            marketplaceService.getOrgDoctors(orgSummary.id),
          ]);
          for (const m of memberships) {
            results.push(marketplaceService.membershipToDoctor(m, org));
            if (results.length >= 4) break;
          }
          if (results.length >= 4) break;
        }
        if (!cancelled) setDoctors([...results].sort((a, b) => b.rating - a.rating));
      } catch {
        // network/data not available yet — show empty state
      } finally {
        if (!cancelled) setLoadingDoctors(false);
      }
    }
    loadMarketplace();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    if (authUser.role === "admin") { navigate("/admin", { replace: true }); return; }
    if (authUser.role === "doctor") { navigate("/doctor-dashboard", { replace: true }); return; }
  }, [authUser, navigate]);

  const isPatient = authUser?.role === "patient";
  // Show the soonest non-closed booking on the hero widget.
  // Sort by session start time so the earliest upcoming session always wins.
  const activeBooking: ActiveBooking | null = isPatient
    ? ([...bookings]
        .filter((b) => {
          try {
            const [hh, mm] = (b.session.endTime ?? "00:00").split(":").map(Number);
            const end = new Date(`${b.session.date}T00:00:00`);
            end.setHours(hh ?? 0, mm ?? 0, 0, 0);
            return end >= new Date();
          } catch { return true; }
        })
        .sort((a, b) => {
          const ta = `${a.session.date}T${a.session.startTime ?? "00:00"}`;
          const tb = `${b.session.date}T${b.session.startTime ?? "00:00"}`;
          return ta < tb ? -1 : ta > tb ? 1 : 0;
        })[0] ?? null)
    : null;

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
          <div className={`grid items-center gap-12 ${activeBooking ? "lg:grid-cols-[1fr_360px]" : "lg:grid-cols-1"}`}>
            {/* Left */}
            <div>
              <span
                className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80"
                style={{ animationDelay: "0ms" }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-gold opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                {t("Egypt's #1 Healthcare Booking Platform")}
              </span>

              <h1 className="mt-5 font-heading leading-tight text-white">
                <span
                  className="block animate-fade-up text-5xl font-bold md:text-6xl"
                  style={{ animationDelay: "120ms" }}
                >
                  {t("Book Your Doctor.")}
                </span>
                <span
                  className="block animate-fade-up text-5xl font-bold text-gold md:text-6xl"
                  style={{ animationDelay: "240ms" }}
                >
                  {t("Skip the Wait.")}
                </span>
              </h1>

              <p
                className="mt-6 max-w-lg animate-fade-up text-lg leading-7 text-white/70"
                style={{ animationDelay: "360ms" }}
              >
                {t("Find, compare and book appointments with Egypt's top specialists — online, instantly, no phone calls.")}
              </p>

              {/* Search widget */}
              <div
                className="mt-8 max-w-2xl animate-fade-up rounded-xl bg-white p-4 shadow-2xl"
                style={{ animationDelay: "480ms" }}
              >
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="h-12 rounded-md border border-border px-4 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>

                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="h-12 rounded-md border border-border px-4 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                  >
                    {AREAS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleSearch}
                    className="h-12 rounded-md bg-gold px-6 text-sm font-medium text-navy transition hover:scale-105 hover:bg-gold-light active:scale-95"
                  >
                    {t("Search Doctors")}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-6 md:grid-cols-4">
                {STATS.map(({ value, label }, i) => (
                  <div
                    key={label}
                    className="animate-fade-up"
                    style={{ animationDelay: `${580 + i * 100}ms` }}
                  >
                    <p className="font-heading text-3xl font-bold text-gold">
                      {value}
                    </p>
                    <p className="mt-1 text-sm text-white/60">{t(label)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — live ticket: only for patients with an active booking */}
            {activeBooking && (
              <div
                className="hidden animate-slide-in-right lg:block"
                style={{ animationDelay: "300ms" }}
              >
                <TicketPreview booking={activeBooking} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Top Specialists ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div className="animate-fade-up">
            <p className="text-sm font-medium text-gold">
              {t("Highly rated — available now")}
            </p>
            <h2 className="font-heading text-4xl font-bold text-navy">
              {t("Top Specialists")}
            </h2>
          </div>
          <button
            onClick={() => navigate("/search")}
            className="animate-fade-up text-sm font-medium text-navy transition hover:text-gold"
            style={{ animationDelay: "100ms" }}
          >
            {t("View all →")}
          </button>
        </div>

        {loadingDoctors ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-border bg-white p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-border" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-border" />
                    <div className="h-3 w-1/2 rounded bg-border" />
                  </div>
                </div>
                <div className="mt-4 h-3 w-full rounded bg-border" />
                <div className="mt-2 h-3 w-2/3 rounded bg-border" />
              </div>
            ))}
          </div>
        ) : doctors.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {doctors.map((doctor, i) => (
              <div
                key={doctor.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <DoctorCard doctor={doctor} />
              </div>
            ))}
          </div>
        ) : (
          <div className="animate-fade-up flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white py-16 text-center">
            <p className="text-4xl">🏥</p>
            <h3 className="mt-4 font-heading text-xl font-bold text-navy">
              {t("Growing our network")}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-navy-mid">
              {t("Clinics and specialists are joining Waitless every week. Be among the first to list your practice and reach patients near you.")}
            </p>
            <button
              onClick={() => navigate("/org/signup")}
              className="mt-6 rounded-md bg-navy px-6 py-2.5 text-sm font-medium text-white transition hover:bg-navy-mid"
            >
              {t("Register your clinic →")}
            </button>
          </div>
        )}
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="bg-navy py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="animate-fade-up text-sm font-medium text-gold">
            {t("Simple & Transparent")}
          </p>
          <h2
            className="mt-2 animate-fade-up font-heading text-4xl font-bold text-white"
            style={{ animationDelay: "100ms" }}
          >
            {t("How It Works")}
          </h2>
          <p
            className="mt-3 animate-fade-up text-white/60"
            style={{ animationDelay: "200ms" }}
          >
            {t("Three easy steps to skip the waiting room forever.")}
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="animate-fade-up rounded-xl bg-white/5 p-7 text-left transition hover:bg-white/10"
                style={{ animationDelay: `${300 + i * 150}ms` }}
              >
                <span className="font-heading text-4xl font-bold text-gold/30">
                  {step.num}
                </span>
                <div className="mt-4 text-3xl transition-transform hover:scale-110 inline-block">{step.icon}</div>
                <h3 className="mt-3 font-heading text-xl font-bold text-white">
                  {t(step.title)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {t(step.desc)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="animate-fade-up flex flex-col items-center justify-between gap-6 rounded-2xl bg-gold-tint px-8 py-10 transition hover:shadow-lg sm:flex-row">
          <div>
            <h3 className="font-heading text-2xl font-bold text-navy">
              {t("Ready to skip the wait?")}
            </h3>
            <p className="mt-1 text-sm text-navy-mid">
              {t("Join thousands of patients who book smarter every day.")}
            </p>
          </div>
          <button
            onClick={() => navigate("/search")}
            className="shrink-0 rounded-md bg-navy px-8 py-3 text-sm font-medium text-white transition hover:scale-105 hover:bg-navy-mid active:scale-95"
          >
            {t("Find Your Doctor →")}
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Live Ticket Widget — only rendered for patients with an active booking ──

function TicketPreview({ booking }: { booking: ActiveBooking }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const progress = booking.queueNumber > 0
    ? Math.min(1, (booking.queueNumber - 1) / Math.max(1, booking.queueNumber))
    : 0.5;
  const dashLen = 376.99;
  const dashOffset = dashLen * (1 - progress);

  return (
    <div className="animate-float w-full rounded-2xl border border-white/15 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50">{t("Your active booking")}</p>
          <p className="font-heading text-lg font-bold text-white">
            {t("Live queue ticket")}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-medium text-white">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {t("Live")}
        </span>
      </div>

      <div className="rounded-xl bg-navy-mid p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading font-bold text-navy">
            {booking.doctor.initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {booking.doctor.name}
            </p>
            <p className="text-xs text-white/50">
              {booking.doctor.specialty} · {booking.doctor.area}
            </p>
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
              strokeDasharray={String(dashLen)}
              strokeDashoffset={String(dashOffset)}
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div className="animate-bounce-in text-center" style={{ animationDelay: "600ms" }}>
            <span className="font-heading text-5xl font-bold leading-none text-white">
              {booking.queueNumber}
            </span>
            <p className="text-xs text-white/50">{t("your position")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/10 p-2.5 text-center transition hover:bg-white/15">
            <p className="font-heading text-xl font-bold text-gold">
              {booking.session.startTime}
            </p>
            <p className="text-xs text-white/50">{t("Session start")}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2.5 text-center transition hover:bg-white/15">
            <p className="font-heading text-xl font-bold text-white">
              {booking.doctor.fee > 0 ? `${booking.doctor.fee} EGP` : "—"}
            </p>
            <p className="text-xs text-white/50">{t("Fee")}</p>
          </div>
        </div>

        <button
          onClick={() => navigate("/ticket")}
          className="mt-3 w-full rounded-lg bg-gold/20 py-2 text-xs font-medium text-gold transition hover:bg-gold/30"
        >
          {t("View full ticket →")}
        </button>
      </div>
    </div>
  );
}

// ── Doctor Card ───────────────────────────────────────────────────────────────

function DoctorCard({ doctor }: { doctor: Doctor }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <article
      onClick={() => navigate(`/doctors/${doctor.id}`)}
      className="group cursor-pointer rounded-xl border border-border bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-gold hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-lg font-bold text-navy transition group-hover:scale-110">
          {doctor.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg font-bold leading-tight text-navy">
            {doctor.name}
          </h3>
          <p className="mt-0.5 text-xs text-navy-mid">{doctor.title}</p>
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            <span className="text-gold">★</span>
            <span className="font-medium text-navy">
              {doctor.rating > 0 ? doctor.rating.toFixed(1) : t("New")}
            </span>
            {doctor.reviewCount > 0 && (
              <span className="text-xs text-navy-mid">({doctor.reviewCount})</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-gold-tint px-2 py-0.5 text-xs font-medium text-navy">
          {doctor.specialty || t("General")}
        </span>
        <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-success">
          {doctor.availableLabel}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <p className="font-heading text-2xl font-bold text-gold">
          {doctor.fee > 0 ? (
            <>
              {doctor.fee}
              <span className="ml-1 font-body text-sm font-normal text-navy-mid">EGP</span>
            </>
          ) : (
            <span className="font-body text-base font-medium text-navy-mid">{t("Contact for fee")}</span>
          )}
        </p>
        <span className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition group-hover:bg-navy-mid">
          {t("View Profile →")}
        </span>
      </div>
    </article>
  );
}
