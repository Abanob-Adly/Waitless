import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirmPasswordReset, isAuthLoading, authError, clearAuthError } = useAuth();

  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!token.trim()) errs.token = "Invalid reset link.";
    if (newPassword.length < 8) errs.newPassword = "Password must be at least 8 characters.";
    if (newPassword !== confirm) errs.confirm = "Passwords do not match.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearAuthError();
    if (!validate()) return;
    const ok = await confirmPasswordReset(token.trim(), newPassword);
    if (ok) {
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Reset password</h1>
          <p className="mt-1 text-sm text-white/50">Create a new password to finish resetting your account</p>
        </div>

        <div className="px-8 py-7">
          {done ? (
            <div className="rounded-md bg-success/10 px-4 py-4 text-sm text-success">
              Password reset successfully! Redirecting to login…
            </div>
          ) : (
            <>
              {(authError || errors.token) && (
                <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
                  {authError || errors.token}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field
                  label="New password *"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={setNewPassword}
                  error={errors.newPassword}
                />
                <Field
                  label="Confirm new password *"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={setConfirm}
                  error={errors.confirm}
                />

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-md bg-gold py-3 text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
                >
                  {isAuthLoading ? "Resetting…" : "Reset Password →"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-navy-mid">
                Go back to{" "}
                <Link to="/login" className="font-medium text-gold transition hover:text-gold-light">
                  Sign in →
                </Link>
              </p>
            </>
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
  maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
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
        maxLength={maxLength}
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
