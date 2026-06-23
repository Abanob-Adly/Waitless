import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MOCK_REVIEWS } from "../data/mockData";
import type { Review } from "../data/mockData";
import { fetchDoctorProfile, fetchSessions } from "../services/mockApi";
import { validatePhone } from "../utils/validation";
import { Tabs } from "../components/ui/Tabs";
import { useApp } from "../context/AppContext";
import type { Doctor, Session, ClinicLocation } from "../context/AppContext";

// ── Page ──────────────────────────────────────────────────────────────────────

export function DoctorProfile() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const { patient, setBookingIntent } = useApp();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!doctorId) return;
    setIsLoading(true);
    setDoctor(null);
    setSessions([]);
    setSelectedSession(null);
    Promise.all([
      fetchDoctorProfile(doctorId),
      fetchSessions(doctorId),
    ]).then(([doc, sess]) => {
      setDoctor(doc);
      setSessions(sess);
      setIsLoading(false);
    });
  }, [doctorId]);

  // Reviews are read-only mock data — synchronous filter is fine
  const reviews = MOCK_REVIEWS.filter((r) => r.doctorId === doctorId);

  // Loading spinner while initial fetch is in flight
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

  function openBookingModal() {
    if (!selectedSession) return;
    // Returning patient: skip modal, go straight to checkout
    if (patient) {
      setBookingIntent({ doctor, session: selectedSession });
      navigate("/checkout", {
        state: {
          doctor,
          session: selectedSession,
          patientName: patient.name,
          patientPhone: patient.phone,
        },
      });
      return;
    }
    setShowModal(true);
    setFormName("");
    setFormPhone("");
    setFormError("");
  }

  function handlePatientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!formName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }
    const phoneResult = validatePhone(formPhone.trim());
    if (!phoneResult.valid) {
      setFormError(phoneResult.error);
      return;
    }
    setIsSubmitting(true);
    setBookingIntent({ doctor, session: selectedSession! });
    setShowModal(false);
    navigate("/checkout", {
      state: {
        doctor,
        session: selectedSession,
        patientName: formName.trim(),
        patientPhone: formPhone.trim(),
      },
    });
  }

  // Tab content definitions
  const tabItems = [
    {
      id: "about",
      label: "About",
      content: <AboutTab doctor={doctor} />,
    },
    {
      id: "clinics",
      label: "Clinic Locations",
      content: <ClinicsTab clinics={doctor.clinics} />,
    },
    {
      id: "reviews",
      label: `Reviews (${reviews.length})`,
      content: <ReviewsTab reviews={reviews} overallRating={doctor.rating} reviewCount={doctor.reviewCount} />,
    },
  ];

  return (
    <>
      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1.5 rounded-md bg-offwhite px-3 py-1.5 text-sm text-navy-mid transition hover:bg-border hover:text-navy"
        >
          ← Back to results
        </button>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* ── Left column ── */}
          <div className="space-y-6">
            {/* Doctor header card */}
            <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-start gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-2xl font-bold text-navy">
                  {doctor.initials}
                </div>

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

            {/* ── Interactive Tabs ── */}
            <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <Tabs items={tabItems} defaultTab="about" />
            </section>

            {/* ── Accepted Insurance ── */}
            <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h2 className="font-heading text-xl font-bold text-navy">
                Accepted Insurance
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {doctor.insurance.map((ins) => (
                  <span
                    key={ins}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-navy"
                  >
                    {ins}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* ── Right sidebar — Booking Widget ── */}
          <aside>
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
                  // Skeleton shimmer while sessions are fetching
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
                    {sessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        selected={selectedSession?.id === session.id}
                        onSelect={() =>
                          setSelectedSession(
                            selectedSession?.id === session.id
                              ? null
                              : session,
                          )
                        }
                      />
                    ))}
                  </div>
                )}

                {/* CTA */}
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
                      onClick={openBookingModal}
                      className="h-12 w-full rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
                    >
                      Book Appointment →
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

                {/* Quick stats */}
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

      {/* ── Patient Details Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="bg-navy px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading font-bold text-navy">
                  {doctor.initials}
                </div>
                <div>
                  <p className="font-heading text-base font-bold text-white">
                    {doctor.name}
                  </p>
                  <p className="text-xs text-white/60">
                    {selectedSession?.date} · {selectedSession?.startTime}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              aria-label="Close"
              className="absolute right-4 top-4 text-xl text-white/60 transition hover:text-white"
            >
              ✕
            </button>

            {/* Body */}
            <div className="p-6">
              <h2 className="font-heading text-2xl font-bold text-navy">
                Your Details
              </h2>
              <p className="mt-1 text-sm text-navy-mid">
                We&apos;ll use these to identify your appointment.
              </p>

              {formError && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
                  {formError}
                </p>
              )}

              <form onSubmit={handlePatientSubmit} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-navy">
                    Full Name *
                  </span>
                  <input
                    type="text"
                    placeholder="Ahmed Mohamed"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    autoFocus
                    className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold focus:ring-1 focus:ring-gold"
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
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold focus:ring-1 focus:ring-gold"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
                >
                  {isSubmitting ? "Redirecting…" : "Continue to Payment →"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab content components ────────────────────────────────────────────────────

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

function ReviewsTab({
  reviews,
  overallRating,
  reviewCount,
}: {
  reviews: Review[];
  overallRating: number;
  reviewCount: number;
}) {
  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
    pct: reviews.length
      ? Math.round(
          (reviews.filter((r) => r.rating === stars).length / reviews.length) *
            100,
        )
      : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-8 rounded-xl bg-offwhite p-5">
        <div className="text-center">
          <p className="font-heading text-5xl font-bold text-navy">
            {overallRating}
          </p>
          <p className="mt-1 text-gold">
            {"★".repeat(Math.floor(overallRating))}
          </p>
          <p className="mt-1 text-xs text-navy-mid">
            {reviewCount} reviews
          </p>
        </div>

        <div className="flex-1 space-y-2">
          {breakdown.map(({ stars, pct }) => (
            <div key={stars} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-right text-navy-mid">{stars}</span>
              <span className="text-xs text-gold">★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-xs text-navy-mid">{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual reviews */}
      {reviews.length === 0 ? (
        <p className="text-sm text-navy-mid">No reviews yet.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
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
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition ${
        selected
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
          <p className="mt-0.5 text-xs text-navy-mid">
            {session.clinicName}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            selected
              ? "bg-gold text-navy"
              : "bg-green-50 text-success"
          }`}
        >
          {selected ? "Selected ✓" : `${session.availableSlots} slots`}
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

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-sm font-bold text-navy">
            {review.patientName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy">
              {review.patientName}
            </p>
            <p className="text-xs text-navy-mid">{review.date}</p>
          </div>
        </div>
        <span className="text-sm text-gold">
          {"★".repeat(review.rating)}
          <span className="text-border">
            {"★".repeat(5 - review.rating)}
          </span>
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-navy-mid">{review.comment}</p>
    </div>
  );
}
