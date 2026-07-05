import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  searchOrgs,
  getOrgDoctors,
  getOrgSessions,
  getMarketplaceOrg,
  getDoctorReviews,
  membershipToDoctor,
  type MarketplaceReview,
} from "../services/marketplaceService";
import { Tabs } from "../components/ui/Tabs";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import type { Doctor, Session, ClinicLocation } from "../types/index";

// ── Page ──────────────────────────────────────────────────────────────────────

export function DoctorProfile() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { setBookingIntent } = useApp();
  const { authUser } = useAuth();
  const { t } = useLanguage();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Persist the resolved orgId so the poll can refresh sessions cheaply
  const resolvedOrgId = useRef<string>("");

  // Re-fetch sessions + doctor fee — called by the 30s poll and the refresh button.
  // Bug root-cause: admin edits DoctorBranchSchedule (fee, avgConsultationMin) but
  // the initial loadProfile result is cached in state. This poll keeps both in sync.
  const refreshSessions = useCallback(async () => {
    if (!resolvedOrgId.current || !doctorId) return;
    try {
      const [freshSessions, freshMembers] = await Promise.all([
        getOrgSessions(resolvedOrgId.current, doctorId),
        getOrgDoctors(resolvedOrgId.current),
      ]);
      setSessions(freshSessions);
      const member = freshMembers.find((m) => m.id === doctorId);
      if (member) {
        setDoctor((prev) => prev ? { ...prev, fee: member.consultationFee } : prev);
      }
    } catch { /* non-fatal */ }
  }, [doctorId]);

  // Full profile load (members + sessions + reviews)
  useEffect(() => {
    if (!doctorId) return;
    setIsLoading(true);
    setDoctor(null);
    setSessions ([]);
    setReviews([]);
    setSelectedSession(null);
    resolvedOrgId.current = "";

    const stateOrgId = (location.state as { orgId?: string } | null)?.orgId ?? "";

    async function loadProfile(orgId: string) {
      resolvedOrgId.current = orgId;
      const [members, sess, fullOrg] = await Promise.all([
        getOrgDoctors(orgId),
        getOrgSessions(orgId, doctorId),
        getMarketplaceOrg(orgId),
      ]);
      const member = members.find((m) => m.id === doctorId);
      if (!member) return;
      setDoctor(membershipToDoctor(member, fullOrg));
      setSessions(sess);
      const rev = await getDoctorReviews(orgId, doctorId!);
      setReviews(rev);
    }

    async function load() {
      try {
        if (stateOrgId) {
          await loadProfile(stateOrgId);
        } else {
          const orgs = await searchOrgs();
          for (const org of orgs) {
            const members = await getOrgDoctors(org.id);
            const member = members.find((m) => m.id === doctorId);
            if (member) {
              const [sess, fullOrg, rev] = await Promise.all([
                getOrgSessions(org.id, doctorId),
                getMarketplaceOrg(org.id),
                getDoctorReviews(org.id, doctorId!),
              ]);
              resolvedOrgId.current = org.id;
              setDoctor(membershipToDoctor(member, fullOrg));
              setSessions(sess);
              setReviews(rev);
              return;
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  // Poll sessions every 30s so admin edits (capacity, time, status) appear automatically
  useEffect(() => {
    const id = setInterval(() => { void refreshSessions(); }, 30_000);
    return () => clearInterval(id);
  }, [refreshSessions]);

  if (isLoading && !doctor) {
    return (
      <main className="flex items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-gold" />
      </main>
    );
  }

  if (!doctor) {
    return (
      <main className="py-24 text-center">
        <p className="text-5xl">😕</p>
        <h2 className="mt-4 font-heading text-2xl font-bold text-navy">
          Doctor not found
        </h2>
        <button
          onClick={() => navigate("/search")}
          className="mt-6 rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          Back to Search
        </button>
      </main>
    );
  }

  function openBookingFlow() {
    if (!selectedSession) return;
    if (selectedSession.status === "closed") return;

    if (!authUser) {
      navigate(`/login?next=/doctors/${doctorId}`);
      return;
    }
    if (authUser.role !== "patient") return;

    setBookingIntent({ doctor, session: selectedSession });
    navigate("/checkout", {
      state: {
        doctor,
        session: selectedSession,
        patientName: authUser.profile.name,
        patientPhone: authUser.profile.phone,
      },
    });
  }

  const tabItems = [
    { id: "about", label: "About", content: <AboutTab doctor={doctor} /> },
    {
      id: "clinics",
      label: "Clinic Locations",
      content: <ClinicsTab clinics={doctor.clinics} />,
    },
    {
      id: "reviews",
      label: `Reviews (${reviews.length})`,
      content: (
        <ReviewsTab
          reviews={reviews}
          overallRating={doctor.rating}
          reviewCount={doctor.reviewCount}
          authUser={authUser}
        />
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Back + Refresh */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-md bg-offwhite px-3 py-1.5 text-sm text-navy-mid transition hover:bg-border hover:text-navy"
        >
          ← Back to results
        </button>
        <button
          onClick={() => { void refreshSessions(); }}
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-navy-mid transition hover:border-navy hover:text-navy"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* ── Left column ── */}
        <div className="animate-fade-up space-y-6">
          {/* Doctor header card */}
          <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="flex items-start gap-5">
              {doctor.avatarUrl ? (
                <img
                  src={doctor.avatarUrl}
                  alt={doctor.name}
                  className="h-20 w-20 shrink-0 rounded-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-2xl font-bold text-navy">
                  {doctor.initials}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-3xl font-bold text-navy">
                    {doctor.name}
                  </h1>
                  {doctor.verified && (
                    <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                      ✓ Verified
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-navy-mid">
                  {doctor.title} — {doctor.organization}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <span className="flex items-center gap-1 text-gold">
                    ★{" "}
                    <strong className="text-navy">{doctor.rating}</strong>{" "}
                    <span className="text-navy-mid">
                      ({doctor.reviewCount} reviews)
                    </span>
                  </span>
                  <span className="text-navy-mid">
                    {doctor.experienceYears} years exp.
                  </span>
                  <span className="text-navy-mid">
                    {doctor.languages.join(" · ")}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-gold-tint px-2.5 py-1 text-xs font-medium text-navy">
                    {doctor.specialty}
                  </span>
                  <span className="rounded-md border border-border px-2.5 py-1 text-xs text-navy-mid">
                    {doctor.area}
                  </span>
                  <span className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-success">
                    {doctor.availableLabel}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Tabs */}
          <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <Tabs items={tabItems} defaultTab="about" />
          </section>

          {/* Insurance */}
          <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-bold text-navy">
              {t("Accepted Insurance")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {doctor.insurance.length === 0 ? (
                <p className="text-sm text-navy-mid">{t("No insurances supported")}</p>
              ) : (
                doctor.insurance.map((ins) => (
                  <span
                    key={ins}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-navy"
                  >
                    {ins}
                  </span>
                ))
              )}
            </div>
          </section>
        </div>

        {/* ── Right sidebar — Booking Widget ── */}
        <aside className="animate-slide-in-right" style={{ animationDelay: "150ms" }}>
          <div className="sticky top-24 overflow-hidden rounded-xl border border-border bg-white shadow-md">
            {/* Fee header */}
            <div className="border-b border-border bg-offwhite px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-navy-mid">
                Consultation fee
              </p>
              <p className="mt-0.5 font-heading text-4xl font-bold text-gold">
                {doctor.fee}
                <span className="ml-1 font-body text-lg font-medium text-navy-mid">
                  EGP
                </span>
              </p>
            </div>

            <div className="p-5">
              <h3 className="font-heading text-base font-bold text-navy">
                Available Sessions
              </h3>

              {isLoading ? (
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 w-full animate-pulse rounded-lg bg-offwhite"
                    />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <p className="mt-3 text-sm text-navy-mid">
                  No sessions currently available.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {sessions.map((session, i) => (
                    <div
                      key={session.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <SessionCard
                        session={session}
                        selected={selectedSession?.id === session.id}
                        onSelect={() =>
                          setSelectedSession(
                            selectedSession?.id === session.id ? null : session,
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {selectedSession ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-gold-tint p-3">
                    <p className="text-xs font-semibold text-navy-mid">
                      Selected
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-navy">
                      {selectedSession.date}
                    </p>
                    <p className="text-xs text-navy-mid">
                      {selectedSession.startTime} – {selectedSession.endTime}
                    </p>
                    <p className="text-xs text-navy-mid">
                      {selectedSession.clinicName}
                    </p>
                  </div>

                  <button
                    onClick={openBookingFlow}
                    className="h-12 w-full rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
                  >
                    {authUser ? "Book Appointment →" : "Sign In to Book →"}
                  </button>

                  <button
                    onClick={() => setSelectedSession(null)}
                    className="w-full text-center text-sm text-navy-mid transition hover:text-navy"
                  >
                    Choose a different session
                  </button>
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-offwhite px-4 py-3 text-sm text-navy-mid">
                  Select a session above to continue booking.
                </p>
              )}

              <div className="mt-5 space-y-2 border-t border-border pt-4">
                <Stat icon="⏱" text={`${doctor.experienceYears} years experience`} />
                <Stat icon="🌐" text={doctor.languages.join(", ")} />
                <Stat icon="🏥" text={`${doctor.clinics.length} clinic${doctor.clinics.length > 1 ? "s" : ""}`} />
                <Stat icon="🛡" text={doctor.insurance.join(", ")} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

// ── Tab components ────────────────────────────────────────────────────────────

function AboutTab({ doctor }: { doctor: Doctor }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-bold text-navy">
          About Dr. {doctor.name.split(" ").slice(-1)[0]}
        </h3>
        <p className="mt-3 text-sm leading-7 text-navy-mid">{doctor.bio}</p>
      </div>

      <div>
        <h4 className="mb-3 font-heading text-base font-bold text-navy">
          Key Credentials
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon="⏱" value={`${doctor.experienceYears}`} label="Years Experience" />
          <StatCard icon="★" value={`${doctor.rating}`} label="Patient Rating" />
          <StatCard icon="💬" value={`${doctor.reviewCount}`} label="Reviews" />
          <StatCard icon="🌐" value={doctor.languages.length.toString()} label="Languages" />
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-heading text-base font-bold text-navy">
          Speaks
        </h4>
        <div className="flex gap-2">
          {doctor.languages.map((lang) => (
            <span
              key={lang}
              className="rounded-md border border-border px-3 py-1 text-sm text-navy"
            >
              {lang}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClinicsTab({ clinics }: { clinics: ClinicLocation[] }) {
  return (
    <div className="space-y-3">
      {clinics.map((clinic, idx) => (
        <div
          key={clinic.id}
          className={`flex items-start gap-4 rounded-xl border p-4 ${
            idx === 0
              ? "border-gold bg-gold-tint"
              : "border-border hover:border-navy-mid"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
              idx === 0 ? "bg-gold/20" : "bg-offwhite"
            }`}
          >
            📍
          </div>
          <div>
            <p className="font-heading text-base font-bold text-navy">
              {clinic.name}
            </p>
            <p className="mt-1 text-sm text-navy-mid">{clinic.address}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-navy-mid">
              <span>📞</span> {clinic.phone}
            </p>
          </div>
          {idx === 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-gold px-2.5 py-0.5 text-xs font-medium text-navy">
              Primary
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

type StarRow = { stars: number; count: number; pct: number };

function getRatingBreakdown(reviews: MarketplaceReview[]): StarRow[] {
  const total = reviews.length;
  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating)));
    counts[star] = (counts[star] ?? 0) + 1;
  }
  const rows: StarRow[] = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: counts[stars] ?? 0,
    pct: total > 0 ? Math.round(((counts[stars] ?? 0) / total) * 100) : 0,
  }));
  // Absorb rounding drift into the largest bucket so pcts always sum to 100
  if (total > 0) {
    const drift = 100 - rows.reduce((s, r) => s + r.pct, 0);
    const largest = rows.reduce((best, r) => (r.count > best.count ? r : best), rows[0]);
    largest.pct += drift;
  }
  return rows;
}

function ReviewsTab({
  reviews,
  overallRating,
  reviewCount,
  authUser,
}: {
  reviews: MarketplaceReview[];
  overallRating: number;
  reviewCount: number;
  authUser: import("../types/index").AuthUser;
}) {
  const breakdown = getRatingBreakdown(reviews);
  const isPatient = authUser?.role === "patient";

  const [tokenInput, setTokenInput] = useState("");
  const [reviewCtx, setReviewCtx] = useState<{ doctorName: string; appointmentDate: string } | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleVerifyToken(e: React.FormEvent) {
    e.preventDefault();
    setTokenError("");
    try {
      const { api } = await import("../services/api");
      const res = await api.get<{ data: Record<string, unknown> }>(
        `/reviews/submit?token=${encodeURIComponent(tokenInput.trim())}`,
      );
      const d = res.data.data as Record<string, unknown>;
      if (d.alreadyReviewed) {
        setTokenError("You have already submitted a review for this appointment.");
        return;
      }
      setReviewCtx({
        doctorName: String(d.doctorName ?? ""),
        appointmentDate: String(d.appointmentDate ?? "").slice(0, 10),
      });
    } catch {
      setTokenError("Invalid or expired token. Check your appointment confirmation.");
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const { api } = await import("../services/api");
      await api.post("/reviews/submit", { token: tokenInput.trim(), rating, comment });
      setSubmitted(true);
    } catch {
      setTokenError("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {reviewCount === 0 ? (
        <div className="rounded-xl bg-offwhite px-6 py-10 text-center">
          <p className="text-4xl">⭐</p>
          <p className="mt-3 font-heading text-base font-bold text-navy">No reviews yet</p>
          <p className="mt-1 text-sm text-navy-mid">
            Be the first to review this doctor after your session.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-8 rounded-xl bg-offwhite p-5">
          <div className="text-center">
            <p className="font-heading text-5xl font-bold text-navy">{overallRating}</p>
            <p className="mt-1 text-gold">{"★".repeat(Math.floor(overallRating))}</p>
            <p className="mt-1 text-xs text-navy-mid">{reviewCount.toLocaleString()} reviews</p>
          </div>

          <div className="flex-1 space-y-2">
            {breakdown.map(({ stars, count, pct }) => (
              <div key={stars} className="flex items-center gap-2 text-sm">
                <span className="w-3 text-right text-navy-mid">{stars}</span>
                <span className="text-xs text-gold">★</span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${stars} stars: ${pct}% of reviews`}
                >
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs text-navy-mid">
                  {count.toLocaleString()} · {pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Patient review submission — only visible to patients */}
      {isPatient && (
        <div className="rounded-xl border border-border p-5">
          <h4 className="font-heading text-base font-bold text-navy">Share Your Experience</h4>
          {submitted ? (
            <p className="mt-3 text-sm text-success">Thank you — your review has been submitted!</p>
          ) : reviewCtx ? (
            <form onSubmit={handleSubmitReview} className="mt-3 space-y-3">
              <p className="text-xs text-navy-mid">
                Appointment with {reviewCtx.doctorName} on {reviewCtx.appointmentDate}
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-2xl transition ${star <= rating ? "text-gold" : "text-border"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Tell us about your visit (optional)..."
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              {tokenError && <p className="text-xs text-danger">{tokenError}</p>}
              <button
                type="submit"
                disabled={rating === 0 || submitting}
                className="w-full rounded-md bg-gold py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyToken} className="mt-3 space-y-2">
              <p className="text-xs text-navy-mid">
                Enter the access token from your appointment confirmation to leave a review.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Appointment access token"
                  className="flex-1 h-10 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
                <button
                  type="submit"
                  disabled={!tokenInput.trim()}
                  className="rounded-md bg-navy px-4 text-sm font-medium text-white transition hover:bg-navy-mid disabled:opacity-60"
                >
                  Verify
                </button>
              </div>
              {tokenError && <p className="text-xs text-danger">{tokenError}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  selected,
  onSelect,
}: {
  session: Session;
  selected: boolean;
  onSelect: () => void;
}) {
  const isUnavailable = session.status !== "scheduled";
  const unavailableLabel = session.status === "active" ? "In Progress" : "Closed";
  return (
    <button
      onClick={isUnavailable ? undefined : onSelect}
      disabled={isUnavailable}
      className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isUnavailable
          ? "border-border bg-offwhite"
          : selected
            ? "border-gold bg-gold-tint"
            : "border-border hover:border-gold/50 hover:bg-offwhite"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-navy">{session.date}</p>
          <p className="mt-0.5 text-xs text-navy-mid">
            {session.startTime} – {session.endTime}
          </p>
          <p className="mt-0.5 text-xs text-navy-mid">{session.clinicName}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isUnavailable
              ? "bg-danger/10 text-danger"
              : selected
                ? "bg-gold text-navy"
                : "bg-green-50 text-success"
          }`}
        >
          {isUnavailable ? unavailableLabel : selected ? "Selected ✓" : `${session.availableSlots} slots`}
        </span>
      </div>
    </button>
  );
}

function Stat({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-base">{icon}</span>
      <span className="text-navy-mid">{text}</span>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-offwhite p-3 text-center">
      <p className="text-xl">{icon}</p>
      <p className="mt-1 font-heading text-xl font-bold text-navy">{value}</p>
      <p className="text-xs text-navy-mid">{label}</p>
    </div>
  );
}

function ReviewCard({ review }: { review: MarketplaceReview }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-sm font-bold text-navy">
            {review.patientName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy">{review.patientName}</p>
            <p className="text-xs text-navy-mid">{review.date}</p>
          </div>
        </div>
        <span className="text-sm text-gold">
          {"★".repeat(review.rating)}
          <span className="text-border">{"★".repeat(5 - review.rating)}</span>
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-navy-mid">{review.comment}</p>
    </div>
  );
}
