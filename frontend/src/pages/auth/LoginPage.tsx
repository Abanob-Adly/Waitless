import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authUser, loginWithCredentials, isAuthLoading, authError, clearAuthError } = useAuth();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect whenever authUser becomes available — covers both already-logged-in
  // users landing on /login and the post-login state update from loginWithCredentials.
  // This is reactive so it works even if the synchronous navigate() in handleSubmit
  // loses the race against the auth:logout interceptor clearing localStorage.
  useEffect(() => {
    if (!authUser) return;
    const next = searchParams.get("next");
    const safeNext = next && next.startsWith("/") && next !== "/login" ? next : null;
    if (authUser.role === "patient") {
      navigate(safeNext ?? "/dashboard", { replace: true });
    } else if (authUser.role === "doctor") {
      navigate("/doctor-dashboard", { replace: true });
    } else if (authUser.role === "admin") {
      navigate("/admin", { replace: true });
    } else if (authUser.role === "receptionist") {
      navigate("/reception", { replace: true });
    } else {
      navigate(safeNext ?? "/", { replace: true });
    }
  }, [authUser, navigate, searchParams]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!phone.trim()) errs.phone = "Phone number is required.";
    if (!password) errs.password = "Password is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearAuthError();
    if (!validate()) return;
    // Navigation is handled reactively by the useEffect above once authUser updates.
    await loginWithCredentials(phone.trim(), password);
  }

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Sign in to your account to continue
          </p>
        </div>

        <div className="px-8 py-7">
          {/* Demo credentials hint */}
          <div className="mb-5 rounded-lg border border-border bg-offwhite px-4 py-3 text-xs text-navy-mid">
            <p className="font-semibold text-navy">Sign in with phone or email</p>
            <p className="mt-1 text-navy-mid">
              Use the phone number or email you registered with, along with your password.
            </p>
          </div>

          {authError && (
            <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              type="password"
              placeholder="••••••••"
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
                  Signing in…
                </>
              ) : (
                "Sign In →"
              )}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-navy-mid">
              Don&apos;t have an account?{" "}
              <Link
                to={`/signup${searchParams.get("next") ? `?next=${searchParams.get("next")}` : ""}`}
                className="font-medium text-gold transition hover:text-gold-light"
              >
                Create one →
              </Link>
            </p>
            <Link to="/forgot-password" className="font-medium text-navy-mid transition hover:text-navy">
              Forgot password?
            </Link>
          </div>
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
