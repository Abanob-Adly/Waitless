import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  validatePhone,
  validatePassword,
  validateBirthdate,
} from "../../utils/validation";
import { SPECIALTIES } from "../../data/mockData";

type Role = "patient" | "doctor";

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { registerPatient, registerDoctor, isAuthLoading, authError, clearAuthError } =
    useAuth();

  const [role, setRole] = useState<Role>("patient");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Shared fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Patient-only
  const [birthdate, setBirthdate] = useState("");

  // Doctor-only
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [languagesSpoken, setLanguagesSpoken] = useState("");

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Full name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    const ph = validatePhone(phone.trim());
    if (!ph.valid) errs.phone = ph.error;
    const pw = validatePassword(password);
    if (!pw.valid) errs.password = pw.error;

    if (role === "patient") {
      const bd = validateBirthdate(birthdate);
      if (!bd.valid) errs.birthdate = bd.error;
    }
    // Doctor-specific fields (specialty, licenseNumber) are stored on the Membership
    // created when the doctor accepts an org invite — not on the Account. No validation needed here.
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearAuthError();
    if (!validate()) return;

    const nextPath = searchParams.get("next") ?? "/";
    let ok = false;

    if (role === "patient") {
      ok = await registerPatient({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        birthdate,
        password,
      });
      if (ok) navigate(nextPath);
    } else {
      ok = await registerDoctor({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        specialty,
        licenseNumber: licenseNumber.trim(),
        password,
      });
      if (ok) navigate("/doctor-dashboard");
    }
  }

  function switchRole(r: Role) {
    setRole(r);
    setErrors({});
    clearAuthError();
  }

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">
            Create Account
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Join thousands using Waitless
          </p>
        </div>

        <div className="px-8 py-7">
          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["patient", "doctor"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => switchRole(r)}
                className={`rounded-md border py-3 text-sm font-medium transition ${
                  role === r
                    ? "border-navy bg-navy text-white"
                    : "border-border text-navy-mid hover:border-navy/40 hover:text-navy"
                }`}
              >
                {r === "patient" ? "🧑‍⚕️  I'm a Patient" : "👨‍⚕️  I'm a Doctor"}
              </button>
            ))}
          </div>

          {/* Global error from API */}
          {authError && (
            <div className="mt-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Full Name */}
            <Field
              label="Full Name *"
              placeholder="Ahmed Mohamed"
              value={name}
              onChange={setName}
              error={errors.name}
            />

            {/* Email */}
            <Field
              label="Email Address *"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
            />

            {/* Phone */}
            <Field
              label="Phone Number *"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={setPhone}
              error={errors.phone}
              inputMode="numeric"
            />

            {/* Patient — Birthdate */}
            {role === "patient" && (
              <Field
                label="Date of Birth *"
                type="date"
                placeholder=""
                value={birthdate}
                onChange={setBirthdate}
                error={errors.birthdate}
              />
            )}

            {/* Doctor — Specialty combobox */}
            {role === "doctor" && (
              <div>
                <label className="block text-sm font-medium text-navy">
                  Specialty (configured when joining an organization)
                </label>
                <input
                  list="specialty-options"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Select or type your specialty…"
                  className={`mt-1.5 h-12 w-full rounded-md border bg-white px-3 text-sm text-navy outline-none transition focus:ring-2 ${
                    errors.specialty
                      ? "border-danger focus:ring-danger/20"
                      : "border-border focus:border-gold focus:ring-gold/20"
                  }`}
                />
                <datalist id="specialty-options">
                  {SPECIALTIES.filter((s) => s !== "All Specialties").map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                {errors.specialty && (
                  <p className="mt-1 text-xs text-danger">{errors.specialty}</p>
                )}
              </div>
            )}

            {/* Doctor — License Number */}
            {role === "doctor" && (
              <Field
                label="Medical License Number"
                placeholder="EG-XXXXXX"
                value={licenseNumber}
                onChange={setLicenseNumber}
              />
            )}

            {/* Doctor — Years of Experience */}
            {role === "doctor" && (
              <Field
                label="Years of Experience"
                placeholder="e.g. 5"
                value={yearsOfExperience}
                onChange={setYearsOfExperience}
                inputMode="numeric"
              />
            )}

            {/* Doctor — Languages Spoken */}
            {role === "doctor" && (
              <Field
                label="Languages Spoken (comma-separated)"
                placeholder="Arabic, English"
                value={languagesSpoken}
                onChange={setLanguagesSpoken}
              />
            )}

            {/* Password */}
            <Field
              label="Password *"
              type="password"
              placeholder="Min. 8 chars + 1 number"
              value={password}
              onChange={setPassword}
              error={errors.password}
            />

            <button
              type="submit"
              disabled={isAuthLoading}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-md bg-gold py-3 text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
            >
              {isAuthLoading ? (
                <>
                  <Spinner />
                  Creating account…
                </>
              ) : (
                "Create Account →"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-navy-mid">
            Already have an account?{" "}
            <Link
              to={`/login${searchParams.get("next") ? `?next=${searchParams.get("next")}` : ""}`}
              className="font-medium text-gold transition hover:text-gold-light"
            >
              Sign in →
            </Link>
          </p>

          <p className="mt-3 text-center text-xs text-navy-mid">
            Setting up a clinic?{" "}
            <Link
              to="/org/signup"
              className="font-medium text-gold transition hover:text-gold-light"
            >
              Register your organization →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({
  label,
  placeholder,
  value,
  onChange,
  error,
  type = "text",
  inputMode,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className={`mt-1.5 h-12 w-full rounded-md border bg-white px-4 text-sm text-navy outline-none transition focus:ring-2 ${
          error
            ? "border-danger focus:ring-danger/20"
            : "border-border focus:border-gold focus:ring-gold/20"
        }`}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
