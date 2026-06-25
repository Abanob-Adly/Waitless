import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { onboardOrg, loginUser } from "../../services/mockApi";
import type { OrgType } from "../../types/index";

// ── Page ──────────────────────────────────────────────────────────────────────

export function OrgOnboardingPage() {
  const navigate = useNavigate();
  const { loginWithCredentials } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 fields
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Step 2 fields
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("clinic");
  const [country, setCountry] = useState("EG");
  const [timezone, setTimezone] = useState("Africa/Cairo");
  const [isPublic, setIsPublic] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!adminName.trim()) errs.adminName = "Full name is required.";
    if (!adminPhone.trim()) errs.adminPhone = "Phone number is required.";
    if (!adminEmail.trim()) errs.adminEmail = "Email is required.";
    if (adminPassword.length < 8) errs.adminPassword = "Password must be at least 8 characters.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (!orgName.trim()) errs.orgName = "Organization name is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep1()) return;
    setStep(2);
    setErrors({});
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;
    setIsLoading(true);
    setError(null);

    const result = await onboardOrg({
      adminName: adminName.trim(),
      adminPhone: adminPhone.trim(),
      adminEmail: adminEmail.trim(),
      adminPassword,
      orgName: orgName.trim(),
      orgType,
      country,
      timezone,
      isPublic,
    });

    if (!result.success) {
      setError(result.error ?? "Setup failed. Please try again.");
      setIsLoading(false);
      return;
    }

    // Auto-login as admin
    await loginWithCredentials(adminPhone.trim(), adminPassword);
    setIsLoading(false);
    setStep(3);
  }

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">
            Register Your Organization
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Set up your clinic on Waitless in minutes
          </p>
        </div>

        <div className="px-8 py-7">
          {/* Step indicator */}
          {step < 3 && (
            <div className="mb-6 flex items-center gap-2">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                      s < step
                        ? "bg-success text-white"
                        : s === step
                          ? "bg-gold text-navy"
                          : "bg-border text-navy-mid"
                    }`}
                  >
                    {s < step ? "✓" : s}
                  </div>
                  <span className={`text-xs ${s === step ? "font-medium text-navy" : "text-navy-mid"}`}>
                    {s === 1 ? "Admin Account" : "Organization"}
                  </span>
                  {s < 2 && <div className="h-px w-8 bg-border" />}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <Field
                label="Full Name *"
                placeholder="Khaled Mansour"
                value={adminName}
                onChange={setAdminName}
                error={errors.adminName}
              />
              <Field
                label="Phone Number *"
                placeholder="01XXXXXXXXX"
                value={adminPhone}
                onChange={setAdminPhone}
                error={errors.adminPhone}
                inputMode="numeric"
              />
              <Field
                label="Email Address *"
                placeholder="admin@yourclinic.eg"
                value={adminEmail}
                onChange={setAdminEmail}
                error={errors.adminEmail}
                type="email"
              />
              <Field
                label="Password *"
                placeholder="Min. 8 characters"
                value={adminPassword}
                onChange={setAdminPassword}
                error={errors.adminPassword}
                type="password"
              />
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
              >
                Continue →
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <Field
                label="Organization Name *"
                placeholder="Cairo Medical Group"
                value={orgName}
                onChange={setOrgName}
                error={errors.orgName}
              />

              <div>
                <label className="block text-sm font-medium text-navy">
                  Organization Type
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(["clinic", "hospital", "polyclinic"] as OrgType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOrgType(t)}
                      className={`rounded-md border py-2.5 text-sm font-medium capitalize transition ${
                        orgType === t
                          ? "border-navy bg-navy text-white"
                          : "border-border text-navy-mid hover:border-navy/40 hover:text-navy"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="EG">Egypt</option>
                  <option value="SA">Saudi Arabia</option>
                  <option value="AE">UAE</option>
                  <option value="KW">Kuwait</option>
                  <option value="QA">Qatar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="Africa/Cairo">Africa/Cairo (UTC+2)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                  <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                  <option value="Asia/Kuwait">Asia/Kuwait (UTC+3)</option>
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
                <div>
                  <p className="text-sm font-medium text-navy">
                    List on Waitless Marketplace
                  </p>
                  <p className="text-xs text-navy-mid">
                    Patients can discover and book your doctors online
                  </p>
                </div>
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex h-12 w-full items-center justify-center rounded-md border border-border text-sm font-medium text-navy-mid transition hover:border-navy hover:text-navy"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Spinner /> Creating…
                    </>
                  ) : (
                    "Create Organization →"
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl">
                ✓
              </div>
              <h2 className="font-heading text-2xl font-bold text-navy">
                Organization Created!
              </h2>
              <p className="mt-2 text-sm text-navy-mid">
                <span className="font-medium text-navy">{orgName}</span> is ready.
                You can now add branches, invite staff, and manage sessions.
              </p>
              <button
                onClick={() => navigate("/admin")}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
              >
                Go to Admin Portal →
              </button>
            </div>
          )}
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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
