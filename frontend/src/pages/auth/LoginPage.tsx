import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithCredentials, isAuthLoading, authError, clearAuthError } = useAuth();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    const success = await loginWithCredentials(phone.trim(), password);
    if (success) {
      const next = searchParams.get("next");
      // Use the hook result isn't available synchronously — navigate based on
      // localStorage which was just written by loginWithCredentials
      try {
        const stored = localStorage.getItem("waitless_auth");
        if (stored) {
          const user = JSON.parse(stored) as { role: string };
          if (user.role === "doctor") {
            navigate("/doctor-dashboard");
            return;
          }
          if (user.role === "admin") {
            navigate("/admin");
            return;
          }
          if (user.role === "receptionist") {
            navigate("/reception");
            return;
          }
        }
      } catch {
        // ignore parse errors
      }
      navigate(next ?? "/");
    }
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
            <p className="font-semibold text-navy">Demo accounts</p>
            <p className="mt-1">
              Patient: <span className="font-mono text-navy">01012345678</span>{" "}
              / <span className="font-mono text-navy">Ahmed1234</span>
            </p>
            <p className="mt-0.5">
              Doctor: <span className="font-mono text-navy">01198765432</span> /{" "}
              <span className="font-mono text-navy">Doctor1234</span>
            </p>
            <p className="mt-0.5">
              Admin: <span className="font-mono text-navy">01011112222</span> /{" "}
              <span className="font-mono text-navy">Admin1234</span>
            </p>
            <p className="mt-0.5">
              Reception: <span className="font-mono text-navy">01033334444</span> /{" "}
              <span className="font-mono text-navy">Recept1234</span>
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

          <p className="mt-5 text-center text-sm text-navy-mid">
            Don&apos;t have an account?{" "}
            <Link
              to={`/signup${searchParams.get("next") ? `?next=${searchParams.get("next")}` : ""}`}
              className="font-medium text-gold transition hover:text-gold-light"
            >
              Create one →
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
