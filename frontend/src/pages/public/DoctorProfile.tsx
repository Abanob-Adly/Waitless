import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { mockDoctors } from "../../data/mockDoctors";
import { mockSessions, type Session } from "../../data/mockSessions";
import type { Doctor } from "../../types/doctor";
import { useLanguage } from "../../context/LanguageContext";
import { fmt12 } from "../../utils/time";

// ── Auth helpers (localStorage-backed mock) ──────────────────────────────────

type Patient = { name: string; email: string; phone?: string };

function getPatient(): Patient | null {
  try {
    const raw = localStorage.getItem("waitless_patient");
    return raw ? (JSON.parse(raw) as Patient) : null;
  } catch {
    return null;
  }
}

function savePatient(patient: Patient) {
  localStorage.setItem("waitless_patient", JSON.stringify(patient));
}

// ── Types ────────────────────────────────────────────────────────────────────

type AuthTab = "signup" | "signin";

type SignupForm = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export function DoctorProfile() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { locale } = useLanguage();

  const doctor = mockDoctors.find((d) => d.id === doctorId);
  const sessions = mockSessions.filter((s) => s.doctorId === doctorId);

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>("signup");
  const [signupForm, setSignupForm] = useState<SignupForm>({
    fullName: "",
    phone: "",
    email: "",
    password: "",
  });
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [authError, setAuthError] = useState("");

  if (!doctor) {
    return (
      <div className="min-h-screen bg-offwhite">
        <Navbar />
        <main className="mx-auto max-w-7xl px-6 py-20 text-center">
          <p className="font-heading text-3xl font-bold text-navy">
            Doctor not found
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-medium text-gold hover:text-gold-light"
          >
            ← Back to Marketplace
          </Link>
        </main>
      </div>
    );
  }

  const patient = getPatient();

  function goToConfirmation(session: Session, patientName: string) {
    navigate("/booking/confirm", {
      state: {
        doctorId: doctor!.id,
        sessionId: session.id,
        doctorName: doctor!.fullName,
        doctorInitials: doctor!.initials,
        doctorTitle: doctor!.title,
        clinicName: session.clinicName,
        date: session.date,
        startTime: session.startTime,
        fee: session.fee,
        patientName,
      },
    });
  }

  function handleConfirmBooking() {
    if (!selectedSession) return;
    if (patient) {
      goToConfirmation(selectedSession, patient.name);
      return;
    }
    setShowAuthModal(true);
  }

  function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    if (
      !signupForm.fullName.trim() ||
      !signupForm.email.trim() ||
      !signupForm.password
    ) {
      setAuthError("Please fill in all required fields.");
      return;
    }
    const newPatient: Patient = {
      name: signupForm.fullName.trim(),
      email: signupForm.email.trim(),
      phone: signupForm.phone,
    };
    savePatient(newPatient);
    setShowAuthModal(false);
    if (selectedSession) goToConfirmation(selectedSession, newPatient.name);
  }

  function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    if (!signinEmail.trim() || !signinPassword) {
      setAuthError("Please enter your email and password.");
      return;
    }
    // Mock: any credentials work for demo
    const newPatient: Patient = {
      name: "Ahmed Mohamed",
      email: signinEmail.trim(),
    };
    savePatient(newPatient);
    setShowAuthModal(false);
    if (selectedSession) goToConfirmation(selectedSession, newPatient.name);
  }

  return (
    <>
      <div className="min-h-screen bg-offwhite">
        <Navbar />

        <main className="mx-auto max-w-7xl px-6 py-10">
          <Link
            to="/"
            className="text-sm font-medium text-navy-mid hover:text-gold"
          >
            ← Back to results
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* ── Left column ── */}
            <div className="space-y-6">
              {/* Doctor header */}
              <DoctorHeader doctor={doctor} />

              {/* About */}
              <SectionCard title="About">
                <p className="leading-7 text-navy-mid">{doctor.bio}</p>
              </SectionCard>

              {/* Available Sessions — Flow 10 core feature */}
              <SectionCard
                title="Available Sessions"
                subtitle="Select a session to book your appointment."
              >
                {sessions.length === 0 ? (
                  <p className="text-sm text-navy-mid">
                    No sessions available at this time.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        selected={selectedSession?.id === session.id}
                        onSelect={() => setSelectedSession(session)}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Clinic Locations */}
              <SectionCard title="Clinic Locations">
                <div className="space-y-3">
                  {doctor.clinicLocations.map((clinic) => (
                    <div
                      key={clinic.id}
                      className="rounded-md border border-border p-4"
                    >
                      <p className="font-medium text-navy">{clinic.name}</p>
                      <p className="mt-1 text-sm text-navy-mid">
                        {clinic.address} — 📞 {clinic.phone}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Accepted Insurance */}
              <SectionCard title="Accepted Insurance">
                <div className="flex flex-wrap gap-2">
                  {doctor.acceptedInsurance.map((ins) => (
                    <span
                      key={ins}
                      className="rounded-sm bg-gold-tint px-3 py-1 text-sm font-medium text-navy"
                    >
                      {ins}
                    </span>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* ── Right sidebar ── */}
            <aside className="space-y-4">
              {/* Signed-in indicator */}
              {patient && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-success">
                  Signed in as{" "}
                  <span className="font-semibold">{patient.name}</span>
                </div>
              )}

              <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
                <h2 className="font-heading text-2xl font-bold text-navy">
                  Book Appointment
                </h2>

                {selectedSession ? (
                  <div className="mt-5 space-y-4">
                    {/* Selected session summary */}
                    <div className="rounded-md border border-gold bg-gold-tint p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-navy-mid">
                        Selected Session
                      </p>
                      <p className="mt-2 font-medium text-navy">
                        {selectedSession.date}
                      </p>
                      <p className="text-sm text-navy-mid">
                        {fmt12(selectedSession.startTime, locale)} – {fmt12(selectedSession.endTime, locale)}
                      </p>
                      <p className="mt-1 text-sm text-navy-mid">
                        {selectedSession.clinicName}
                      </p>
                      <p className="mt-3 font-heading text-2xl font-bold text-gold">
                        {selectedSession.fee}{" "}
                        <span className="font-body text-sm font-normal text-navy-mid">
                          EGP
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={handleConfirmBooking}
                      className="h-12 w-full rounded-sm bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
                    >
                      {patient ? "Confirm Booking →" : "Book Appointment"}
                    </button>

                    <button
                      onClick={() => setSelectedSession(null)}
                      className="w-full text-center text-sm text-navy-mid transition hover:text-navy"
                    >
                      Change session
                    </button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm text-navy-mid">
                      Pick a session from the list on the left to get started.
                    </p>
                    <div className="mt-5 rounded-md bg-offwhite p-6 text-center">
                      <p className="text-4xl">📅</p>
                      <p className="mt-3 text-sm text-navy-mid">
                        No session selected yet
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>

      {/* ── Auth Modal overlay ── */}
      {showAuthModal && (
        <AuthModal
          tab={authTab}
          onTabChange={(t) => {
            setAuthTab(t);
            setAuthError("");
          }}
          signupForm={signupForm}
          onSignupChange={(field) =>
            setSignupForm((prev) => ({ ...prev, ...field }))
          }
          onSignup={handleSignup}
          signinEmail={signinEmail}
          onSigninEmailChange={setSigninEmail}
          signinPassword={signinPassword}
          onSigninPasswordChange={setSigninPassword}
          onSignin={handleSignin}
          error={authError}
          onClose={() => {
            setShowAuthModal(false);
            setAuthError("");
          }}
        />
      )}
    </>
  );
}

// ── Doctor Header ────────────────────────────────────────────────────────────

function DoctorHeader({ doctor }: { doctor: Doctor }) {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-3xl font-bold text-navy">
          {doctor.initials}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-4xl font-bold text-navy">
              {doctor.fullName}
            </h1>
            {doctor.verified && (
              <span className="rounded-sm bg-green-50 px-2 py-1 text-xs font-medium text-success">
                ✓ Verified
              </span>
            )}
          </div>

          <p className="mt-2 text-lg text-navy-mid">
            {doctor.title} — {doctor.organizationName}
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-navy-mid">
            <span className="text-gold">★★★★★ {doctor.rating}</span>
            <span>({doctor.reviewsCount} reviews)</span>
            <span>{doctor.experienceYears} years exp.</span>
            <span>{doctor.languages.join(" · ")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section Card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="font-heading text-2xl font-bold text-navy">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-sm text-navy-mid">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

// ── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  selected,
  onSelect,
}: {
  session: Session;
  selected: boolean;
  onSelect: () => void;
}) {
  const { locale } = useLanguage();
  const lowSlots = session.availableSlots <= 3;

  return (
    <div
      className={`rounded-md border p-4 transition ${
        selected
          ? "border-gold bg-gold-tint"
          : "border-border bg-white hover:border-gold/60"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-navy">
            📅 {session.date}
          </p>
          <p className="mt-1 text-sm text-navy-mid">
            {fmt12(session.startTime, locale)} – {fmt12(session.endTime, locale)}
          </p>
          <p className="mt-1 text-sm text-navy-mid">{session.clinicName}</p>
          <p
            className={`mt-2 text-xs font-medium ${
              lowSlots ? "text-danger" : "text-success"
            }`}
          >
            {session.availableSlots} slot
            {session.availableSlots !== 1 ? "s" : ""} available
            {lowSlots && " · Filling fast!"}
          </p>
        </div>

        <button
          onClick={onSelect}
          className={`shrink-0 rounded-sm px-4 py-2 text-sm font-medium transition ${
            selected
              ? "bg-gold text-navy hover:bg-gold-light"
              : "bg-navy text-white hover:bg-navy-mid"
          }`}
        >
          {selected ? "Selected ✓" : "Select"}
        </button>
      </div>
    </div>
  );
}

// ── Auth Modal (Flow 8) ───────────────────────────────────────────────────────

const inputClass =
  "mt-1.5 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy">{label}</span>
      {children}
    </label>
  );
}

type AuthModalProps = {
  tab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
  signupForm: SignupForm;
  onSignupChange: (field: Partial<SignupForm>) => void;
  onSignup: (e: React.FormEvent) => void;
  signinEmail: string;
  onSigninEmailChange: (v: string) => void;
  signinPassword: string;
  onSigninPasswordChange: (v: string) => void;
  onSignin: (e: React.FormEvent) => void;
  error: string;
  onClose: () => void;
};

function AuthModal({
  tab,
  onTabChange,
  signupForm,
  onSignupChange,
  onSignup,
  signinEmail,
  onSigninEmailChange,
  signinPassword,
  onSigninPasswordChange,
  onSignin,
  error,
  onClose,
}: AuthModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-lg bg-white shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-xl text-navy-mid transition hover:text-navy"
        >
          ✕
        </button>

        <div className="p-6 pt-8">
          <h2 className="font-heading text-3xl font-bold text-navy">
            {tab === "signup" ? "Create account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm text-navy-mid">
            {tab === "signup"
              ? "Sign up to confirm your booking and track your queue in real-time."
              : "Sign in to continue with your booking."}
          </p>

          {/* Tabs */}
          <div className="mt-6 grid grid-cols-2 rounded-sm border border-border p-1">
            {(["signup", "signin"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTabChange(t)}
                className={`rounded-sm py-2 text-sm font-medium transition ${
                  tab === t
                    ? "bg-navy text-white"
                    : "text-navy-mid hover:text-navy"
                }`}
              >
                {t === "signup" ? "Sign Up" : "Sign In"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 rounded-sm bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {/* Sign-up form */}
          {tab === "signup" && (
            <form onSubmit={onSignup} className="mt-5 space-y-4">
              <Field label="Full Name *">
                <input
                  type="text"
                  placeholder="Ahmed Mohamed"
                  value={signupForm.fullName}
                  onChange={(e) => onSignupChange({ fullName: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Phone">
                <input
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={signupForm.phone}
                  onChange={(e) => onSignupChange({ phone: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Email *">
                <input
                  type="email"
                  placeholder="ahmed@example.com"
                  value={signupForm.email}
                  onChange={(e) => onSignupChange({ email: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Password *">
                <input
                  type="password"
                  placeholder="Min. 8 characters"
                  value={signupForm.password}
                  onChange={(e) => onSignupChange({ password: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <button
                type="submit"
                className="mt-2 h-12 w-full rounded-sm bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
              >
                Create Account &amp; Continue
              </button>
            </form>
          )}

          {/* Sign-in form */}
          {tab === "signin" && (
            <form onSubmit={onSignin} className="mt-5 space-y-4">
              <Field label="Email *">
                <input
                  type="email"
                  placeholder="ahmed@example.com"
                  value={signinEmail}
                  onChange={(e) => onSigninEmailChange(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Password *">
                <input
                  type="password"
                  placeholder="Your password"
                  value={signinPassword}
                  onChange={(e) => onSigninPasswordChange(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <button
                type="submit"
                className="mt-2 h-12 w-full rounded-sm bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
              >
                Sign In &amp; Continue
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
