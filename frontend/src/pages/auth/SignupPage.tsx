import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService, saveTokens } from "../../services/authService";
import { createOrg, selfJoinAsDoctor as addDoctorRole } from "../../services/orgService";
import * as jr from "../../services/joinRequestService";
import { toE164 } from "../../utils/phone";
import { validatePhone, validatePassword } from "../../utils/validation";
import { SPECIALTIES } from "../../data/mockData";
import type { OrgType } from "../../types/index";

// ── Step types ────────────────────────────────────────────────────────────────

type SignupRole = "patient" | "doctor";

type DoctorPath = "own" | "staff" | null;

type Step =
  | "role"          // Choose patient vs doctor
  | "patient-info"  // Patient: name, email, phone, dob, password
  | "doctor-info"   // Doctor: name, email, phone, specialty, license, password
  | "clinic-type"   // Doctor: own clinic vs work at clinic
  | "clinic-own"    // Doctor + own: org name/type
  | "clinic-find"   // Doctor + staff: search clinics
  | "pending";      // Doctor + staff: request submitted

// ── Page ─────────────────────────────────────────────────────────────────────

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { registerPatient, loginWithCredentials, isAuthLoading, authError, clearAuthError } =
    useAuth();

  const [step, setStep] = useState<Step>("role");
  const [doctorPath, setDoctorPath] = useState<DoctorPath>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

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

  // Clinic-own fields
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("clinic");
  const [country, setCountry] = useState("EG");
  const [isPublic, setIsPublic] = useState(true);

  // Clinic-find fields
  const [clinicSearch, setClinicSearch] = useState("");
  const [clinicResults, setClinicResults] = useState<jr.ClinicSearchResult[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<jr.ClinicSearchResult | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextPath = (() => {
    const raw = searchParams.get("next");
    return raw && raw.startsWith("/") ? raw : "/";
  })();

  // Debounced clinic search
  useEffect(() => {
    if (step !== "clinic-find") return;
    if (!clinicSearch.trim()) { setClinicResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await jr.searchClinics(clinicSearch.trim());
        setClinicResults(results);
      } catch {
        setClinicResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [clinicSearch, step]);

  function clearErrors() {
    setErrors({});
    setApiError(null);
    clearAuthError();
  }

  // ── Validators ────────────────────────────────────────────────────────────

  function validateBasics(isDoctor: boolean): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Full name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    const ph = validatePhone(phone.trim());
    if (!ph.valid) errs.phone = ph.error;
    const pw = validatePassword(password);
    if (!pw.valid) errs.password = pw.error;
    if (!isDoctor) {
      if (!birthdate) errs.birthdate = "Date of birth is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateClinicOwn(): boolean {
    const errs: Record<string, string> = {};
    if (!orgName.trim()) errs.orgName = "Clinic name is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateClinicFind(): boolean {
    const errs: Record<string, string> = {};
    if (!selectedClinic) errs.clinic = "Please select a clinic.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleRoleSelect(r: SignupRole) {
    clearErrors();
    setStep(r === "patient" ? "patient-info" : "doctor-info");
  }

  async function handlePatientSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    clearErrors();
    if (!validateBasics(false)) return;
    const ok = await registerPatient({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      birthdate,
      password,
    });
    if (ok) navigate(nextPath);
  }

  function handleDoctorBasicsNext(e: { preventDefault(): void }) {
    e.preventDefault();
    clearErrors();
    if (!validateBasics(true)) return;
    setStep("clinic-type");
  }

  function handleClinicTypeSelect(path: "own" | "staff") {
    setDoctorPath(path);
    setStep(path === "own" ? "clinic-own" : "clinic-find");
  }

  async function handleClinicOwnSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    clearErrors();
    if (!validateClinicOwn()) return;
    setIsSubmitting(true);
    try {
      // 1. Register worker account
      await authService.registerWorker({
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: toE164(phone.trim()),
        password,
      });

      // 2. Login to get tokens
      await authService.loginWorker(email.trim(), password);

      // 3. Update auth context
      await loginWithCredentials(email.trim(), password);

      // 4. Generate slug + create org (includes admin membership)
      const slug = orgName.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      const { accessToken: orgToken } = await createOrg({
        name: orgName.trim(), slug,
        type: orgType as "clinic" | "hospital" | "polyclinic",
        isPublic,
      });

      // 5. Store org-scoped token so subsequent requests are org-scoped
      const currentRefresh = localStorage.getItem("waitless_refresh_token") ?? "";
      saveTokens(orgToken, currentRefresh);

      // 6. Auto-enroll as doctor (in addition to admin role from createOrg)
      await addDoctorRole(
        // org ID is embedded in JWT — parse it
        (() => { try { return JSON.parse(atob(orgToken.split(".")[1])).activeOrg ?? ""; } catch { return ""; } })(),
        { specialties: specialty ? [specialty] : [], licenseNumber: licenseNumber.trim() || undefined },
      ).catch(() => {}); // non-fatal

      await loginWithCredentials(email.trim(), password);

      navigate("/admin");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Setup failed. Please try again.";
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleJoinRequestSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    clearErrors();
    if (!validateClinicFind()) return;
    setIsSubmitting(true);
    try {
      // 1. Register worker account (or reuse if already exists)
      await authService.registerWorker({
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: toE164(phone.trim()),
        password,
      });

      // 2. Login to get auth token for submit
      await authService.loginWorker(email.trim(), password);
      await loginWithCredentials(email.trim(), password);

      // 3. Submit join request
      await jr.submitJoinRequest(selectedClinic!.id, {
        specialties: specialty ? [specialty] : [],
        licenseNumber: licenseNumber.trim() || undefined,

        message: joinMessage.trim() || undefined,
      });

      setStep("pending");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Request failed. Please try again.";
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Step indicators ───────────────────────────────────────────────────────

  const doctorSteps: Array<{ label: string; step: Step }> = [
    { label: "Your Info", step: "doctor-info" },
    { label: "Clinic Type", step: "clinic-type" },
    { label: doctorPath === "own" ? "Clinic Setup" : "Find Clinic", step: doctorPath === "own" ? "clinic-own" : "clinic-find" },
  ];

  function doctorStepIdx(): number {
    if (step === "doctor-info") return 0;
    if (step === "clinic-type") return 1;
    if (step === "clinic-own" || step === "clinic-find" || step === "pending") return 2;
    return 0;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">

        {/* Header */}
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">
            {step === "role"        && "Create Account"}
            {step === "patient-info" && "Patient Sign Up"}
            {step === "doctor-info"  && "Doctor Sign Up"}
            {step === "clinic-type"  && "How do you work?"}
            {step === "clinic-own"   && "Set Up Your Clinic"}
            {step === "clinic-find"  && "Find Your Clinic"}
            {step === "pending"      && "Request Sent!"}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {step === "role"        && "Join thousands using Waitless"}
            {step === "patient-info" && "Book and track your appointments"}
            {step === "doctor-info"  && "Tell us about yourself"}
            {step === "clinic-type"  && "Choose the path that fits you"}
            {step === "clinic-own"   && "You'll manage the clinic as admin and doctor"}
            {step === "clinic-find"  && "Request to join an existing clinic"}
            {step === "pending"      && "Waiting for clinic admin approval"}
          </p>

          {/* Doctor progress steps */}
          {["doctor-info", "clinic-type", "clinic-own", "clinic-find"].includes(step) && (
            <div className="mt-4 flex items-center gap-2">
              {doctorSteps.map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                    i < doctorStepIdx()
                      ? "bg-gold text-navy"
                      : i === doctorStepIdx()
                        ? "bg-white text-navy"
                        : "bg-white/20 text-white/50"
                  }`}>
                    {i < doctorStepIdx() ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs ${i === doctorStepIdx() ? "font-medium text-white" : "text-white/40"}`}>
                    {s.label}
                  </span>
                  {i < doctorSteps.length - 1 && <div className="h-px w-6 bg-white/20" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-8 py-7">
          {/* API / auth error */}
          {(apiError || authError) && (
            <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
              {apiError ?? authError}
            </div>
          )}

          {/* ── STEP: role ── */}
          {step === "role" && (
            <div className="space-y-4">
              <p className="text-sm text-navy-mid">Who are you signing up as?</p>
              <div className="grid grid-cols-2 gap-3">
                <RoleCard
                  icon="🧑‍⚕️"
                  title="I'm a Patient"
                  desc="Book appointments and track your queue"
                  onClick={() => handleRoleSelect("patient")}
                />
                <RoleCard
                  icon="👨‍⚕️"
                  title="I'm a Doctor"
                  desc="Manage your queue and clinic operations"
                  onClick={() => handleRoleSelect("doctor")}
                />
              </div>
              <p className="mt-4 text-center text-xs text-navy-mid">
                Setting up a clinic?{" "}
                <Link to="/org/signup" className="font-medium text-gold hover:text-gold-light">
                  Register your organization →
                </Link>
              </p>
              <p className="text-center text-sm text-navy-mid">
                Already have an account?{" "}
                <Link to={`/login${nextPath !== "/" ? `?next=${nextPath}` : ""}`} className="font-medium text-gold hover:text-gold-light">
                  Sign in →
                </Link>
              </p>
            </div>
          )}

          {/* ── STEP: patient-info ── */}
          {step === "patient-info" && (
            <form onSubmit={handlePatientSubmit} className="space-y-4">
              <Field label="Full Name *"      placeholder="Ahmed Mohamed"         value={name}      onChange={setName}      error={errors.name} />
              <Field label="Email Address *"  placeholder="you@example.com"       value={email}     onChange={setEmail}     error={errors.email} type="email" />
              <Field label="Phone Number *"   placeholder="01XXXXXXXXX"           value={phone}     onChange={setPhone}     error={errors.phone} inputMode="numeric" />
              <Field label="Date of Birth *"  placeholder=""                      value={birthdate} onChange={setBirthdate} error={errors.birthdate} type="date" />
              <Field label="Password *"       placeholder="Min. 8 chars + 1 number" value={password} onChange={setPassword} error={errors.password} type="password" />
              <div className="flex gap-3">
                <BackBtn onClick={() => { clearErrors(); setStep("role"); }} />
                <button type="submit" disabled={isAuthLoading} className="h-12 flex-1 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60 flex items-center justify-center gap-2">
                  {isAuthLoading ? <><Spinner /> Creating…</> : "Create Account →"}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP: doctor-info ── */}
          {step === "doctor-info" && (
            <form onSubmit={handleDoctorBasicsNext} className="space-y-4">
              <Field label="Full Name *"      placeholder="Dr. Khaled Hassan"     value={name}      onChange={setName}      error={errors.name} />
              <Field label="Email Address *"  placeholder="dr@clinic.eg"          value={email}     onChange={setEmail}     error={errors.email} type="email" />
              <Field label="Phone Number *"   placeholder="01XXXXXXXXX"           value={phone}     onChange={setPhone}     error={errors.phone} inputMode="numeric" />
              <div>
                <label className="block text-sm font-medium text-navy">Specialty</label>
                <input
                  list="specialty-options"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Select or type your specialty…"
                  className="mt-1.5 h-12 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
                <datalist id="specialty-options">
                  {SPECIALTIES.filter((s) => s !== "All Specialties").map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <Field label="Medical License Number" placeholder="EG-XXXXXX"     value={licenseNumber} onChange={setLicenseNumber} />
              <Field label="Password *"       placeholder="Min. 8 chars + 1 number" value={password} onChange={setPassword} error={errors.password} type="password" />
              <div className="flex gap-3">
                <BackBtn onClick={() => { clearErrors(); setStep("role"); }} />
                <button type="submit" className="h-12 flex-1 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light flex items-center justify-center">
                  Continue →
                </button>
              </div>
            </form>
          )}

          {/* ── STEP: clinic-type ── */}
          {step === "clinic-type" && (
            <div className="space-y-4">
              <p className="text-sm text-navy-mid">Do you run your own clinic or work at an existing one?</p>
              <div className="space-y-3">
                <ClinicTypeCard
                  icon="🏥"
                  title="I own my clinic"
                  desc="Create a new clinic on Waitless — you'll be the admin and a doctor"
                  onClick={() => handleClinicTypeSelect("own")}
                />
                <ClinicTypeCard
                  icon="👔"
                  title="I work at an existing clinic"
                  desc="Search for your clinic and request to join — the admin will approve you"
                  onClick={() => handleClinicTypeSelect("staff")}
                />
              </div>
              <BackBtn onClick={() => { clearErrors(); setStep("doctor-info"); }} />
            </div>
          )}

          {/* ── STEP: clinic-own ── */}
          {step === "clinic-own" && (
            <form onSubmit={handleClinicOwnSubmit} className="space-y-4">
              <Field label="Clinic Name *" placeholder="Cairo Medical Group" value={orgName} onChange={setOrgName} error={errors.orgName} />
              <div>
                <label className="block text-sm font-medium text-navy">Type</label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(["clinic", "hospital", "polyclinic"] as OrgType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOrgType(t)}
                      className={`rounded-md border py-2.5 text-sm font-medium capitalize transition ${
                        orgType === t ? "border-navy bg-navy text-white" : "border-border text-navy-mid hover:border-navy/40 hover:text-navy"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy">Country</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20">
                  <option value="EG">Egypt</option>
                  <option value="SA">Saudi Arabia</option>
                  <option value="AE">UAE</option>
                  <option value="KW">Kuwait</option>
                  <option value="QA">Qatar</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 accent-gold" />
                <div>
                  <p className="text-sm font-medium text-navy">List on Marketplace</p>
                  <p className="text-xs text-navy-mid">Patients can discover and book your doctors online</p>
                </div>
              </label>
              <div className="flex gap-3">
                <BackBtn onClick={() => { clearErrors(); setStep("clinic-type"); }} />
                <button type="submit" disabled={isSubmitting} className="h-12 flex-1 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60 flex items-center justify-center gap-2">
                  {isSubmitting ? <><Spinner /> Creating…</> : "Create Clinic →"}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP: clinic-find ── */}
          {step === "clinic-find" && (
            <form onSubmit={handleJoinRequestSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy">Search for your clinic *</label>
                <input
                  value={clinicSearch}
                  onChange={(e) => { setClinicSearch(e.target.value); setSelectedClinic(null); }}
                  placeholder="Type clinic name…"
                  className="mt-1.5 h-12 w-full rounded-md border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
                {searchLoading && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-navy-mid"><Spinner /> Searching…</p>
                )}
                {clinicResults.length > 0 && !selectedClinic && (
                  <ul className="mt-1.5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-white shadow-md">
                    {clinicResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => { setSelectedClinic(c); setClinicResults([]); setClinicSearch(c.name); }}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-offwhite"
                        >
                          <div>
                            <p className="font-medium text-navy">{c.name}</p>
                            <p className="text-xs capitalize text-navy-mid">{c.type}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {clinicSearch && !searchLoading && clinicResults.length === 0 && !selectedClinic && (
                  <p className="mt-1.5 text-xs text-navy-mid">No clinics found. Try a different name.</p>
                )}
                {selectedClinic && (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-gold/30 bg-gold-tint px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-navy">{selectedClinic.name}</p>
                      <p className="text-xs capitalize text-navy-mid">{selectedClinic.type}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedClinic(null); setClinicSearch(""); }} className="text-xs text-danger hover:text-danger/80">Change</button>
                  </div>
                )}
                {errors.clinic && <p className="mt-1 text-xs text-danger">{errors.clinic}</p>}
              </div>

              <Field label="Message to Admin (optional)" placeholder="Introduce yourself briefly…" value={joinMessage} onChange={setJoinMessage} />

              <div className="flex gap-3">
                <BackBtn onClick={() => { clearErrors(); setStep("clinic-type"); }} />
                <button type="submit" disabled={isSubmitting || !selectedClinic} className="h-12 flex-1 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60 flex items-center justify-center gap-2">
                  {isSubmitting ? <><Spinner /> Sending…</> : "Send Join Request →"}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP: pending ── */}
          {step === "pending" && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 text-3xl">
                ⏳
              </div>
              <h2 className="font-heading text-xl font-bold text-navy">Request Submitted!</h2>
              <p className="mt-2 text-sm text-navy-mid">
                Your request to join <span className="font-semibold text-navy">{selectedClinic?.name}</span> has been sent.
              </p>
              <p className="mt-1 text-sm text-navy-mid">
                The clinic admin will review and approve your request. You'll be able to log in once approved.
              </p>
              <div className="mt-5 rounded-xl border border-border bg-offwhite px-4 py-3 text-left">
                <p className="text-xs font-semibold text-navy">While you wait</p>
                <ul className="mt-1.5 space-y-1 text-xs text-navy-mid">
                  <li>• Log in any time to check your request status</li>
                  <li>• Watch for an email invitation from the clinic</li>
                  <li>• Once approved, you'll get full doctor access</li>
                </ul>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
              >
                Go to Sign In →
              </button>
            </div>
          )}

          {/* Footer link for role/info steps */}
          {(step === "patient-info" || step === "doctor-info") && (
            <p className="mt-5 text-center text-sm text-navy-mid">
              Already have an account?{" "}
              <Link to={`/login${nextPath !== "/" ? `?next=${nextPath}` : ""}`} className="font-medium text-gold hover:text-gold-light">
                Sign in →
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleCard({
  icon, title, desc, onClick,
}: {
  icon: string; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl border border-border bg-white p-4 text-left transition hover:border-navy/40 hover:shadow-sm active:scale-[0.98]"
    >
      <span className="text-2xl">{icon}</span>
      <p className="font-heading text-sm font-bold text-navy">{title}</p>
      <p className="text-xs text-navy-mid leading-relaxed">{desc}</p>
    </button>
  );
}

function ClinicTypeCard({
  icon, title, desc, onClick,
}: {
  icon: string; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-4 rounded-xl border border-border bg-white p-4 text-left transition hover:border-gold/40 hover:bg-gold-tint hover:shadow-sm active:scale-[0.98] w-full"
    >
      <span className="mt-0.5 text-2xl">{icon}</span>
      <div>
        <p className="font-heading text-sm font-bold text-navy">{title}</p>
        <p className="mt-0.5 text-xs text-navy-mid leading-relaxed">{desc}</p>
      </div>
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 rounded-md border border-border px-4 text-sm font-medium text-navy-mid transition hover:border-navy hover:text-navy"
    >
      ← Back
    </button>
  );
}

function Field({
  label, placeholder, value, onChange, error, type = "text", inputMode,
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
          error ? "border-danger focus:ring-danger/20" : "border-border focus:border-gold focus:ring-gold/20"
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
