import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { saveTokens } from "../../services/authService";
import { toE164 } from "../../utils/phone";

// ── Page ──────────────────────────────────────────────────────────────────────

type InviteInfo = {
  organization: { name?: string; _id?: string };
  kind: "admin" | "doctor" | "receptionist";
  inviteEmail: string;
};

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithCredentials, logout, authUser } = useAuth();

  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [languagesSpoken, setLanguagesSpoken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenInvalid(true);
      setTokenLoading(false);
      return;
    }
    api
      .get<{ organization: InviteInfo["organization"]; kind: InviteInfo["kind"]; inviteEmail: string }>(
        `/memberships/invites/${token}`,
      )
      .then((res) => {
        // Clear any existing session so the invite flow starts clean
        if (authUser !== null) logout();
        setInvite(res.data);
        setTokenLoading(false);
      })
      .catch(() => {
        setTokenInvalid(true);
        setTokenLoading(false);
      });
  }, [token]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Full name is required.";
    if (!phone.trim()) errs.phone = "Phone number is required.";
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !invite) return;
    setIsLoading(true);
    setApiError(null);

    try {
      // Accept with new account — backend creates the account and activates membership
      const isDoctor = invite.kind === "doctor";
      const langs = languagesSpoken.trim()
        ? languagesSpoken.split(",").map((l) => l.trim()).filter(Boolean)
        : undefined;
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        "/memberships/invites/accept/new",
        {
          token,
          fullName: name.trim(),
          password,
          phone: toE164(phone.trim()),
          ...(isDoctor && yearsOfExperience ? { yearsOfExperience: Number(yearsOfExperience) } : {}),
          ...(isDoctor && langs?.length ? { languagesSpoken: langs } : {}),
        },
      );

      const { accessToken, refreshToken } = res.data;
      saveTokens(accessToken, refreshToken);

      // Log in via context so AuthContext picks up the new user
      const email = invite.inviteEmail;
      await loginWithCredentials(email || name.trim(), password);

      const role = invite.kind;
      if (role === "admin") navigate("/admin");
      else if (role === "receptionist") navigate("/reception");
      else navigate("/doctor-dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to accept invitation.";
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const roleLabel: Record<string, string> = {
    admin: "Administrator",
    doctor: "Doctor",
    receptionist: "Receptionist",
  };

  if (tokenLoading) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4">
        <div className="flex gap-2 text-navy-mid">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Verifying invitation…
        </div>
      </main>
    );
  }

  if (tokenInvalid) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
        <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
          <div className="bg-navy px-8 py-7">
            <p className="font-heading text-sm font-medium text-gold">Waitless</p>
            <h1 className="mt-1 font-heading text-3xl font-bold text-white">
              Invalid Invitation
            </h1>
          </div>
          <div className="px-8 py-7 text-center">
            <p className="text-5xl">🔗</p>
            <p className="mt-4 font-heading text-xl font-bold text-navy">
              This invitation link is invalid or has already been used.
            </p>
            <p className="mt-2 text-sm text-navy-mid">
              Please ask your administrator to send a new invitation.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="mt-6 rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
            >
              Go to Sign In →
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-2xl font-bold text-white">
            You've been invited to join
          </h1>
          {invite && (
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold">
                {roleLabel[invite.kind] ?? invite.kind}
              </span>
              {invite.organization?.name && (
                <span className="text-sm text-white/60">{invite.organization.name}</span>
              )}
            </div>
          )}
        </div>

        <div className="px-8 py-7">
          {apiError && (
            <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
              {apiError}
            </div>
          )}

          <p className="mb-5 text-sm text-navy-mid">
            Create your account to accept this invitation and access the portal.
          </p>

          {invite?.inviteEmail && (
            <div className="mb-4 rounded-md border border-border bg-offwhite px-4 py-3 text-sm text-navy">
              Invited as:{" "}
              <span className="font-medium">{invite.inviteEmail}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Full Name *"
              placeholder="Your name"
              value={name}
              onChange={setName}
              error={errors.name}
            />
            <Field
              label="Phone Number *"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={setPhone}
              error={errors.phone}
              inputMode="numeric"
            />
            <Field
              label="Password *"
              placeholder="Min. 8 characters"
              value={password}
              onChange={setPassword}
              error={errors.password}
              type="password"
            />
            {invite?.kind === "doctor" && (
              <>
                <Field
                  label="Years of Experience"
                  placeholder="e.g. 5"
                  value={yearsOfExperience}
                  onChange={setYearsOfExperience}
                  inputMode="numeric"
                />
                <Field
                  label="Languages Spoken (comma-separated)"
                  placeholder="Arabic, English"
                  value={languagesSpoken}
                  onChange={setLanguagesSpoken}
                />
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Spinner /> Joining…
                </>
              ) : (
                "Accept Invitation →"
              )}
            </button>
          </form>
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
