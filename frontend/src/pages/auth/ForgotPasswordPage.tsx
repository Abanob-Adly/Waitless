import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function ForgotPasswordPage() {
  const { requestPasswordReset, isAuthLoading, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearAuthError();
    if (!email.trim()) { setError("Email is required."); return; }
    setError("");
    const ok = await requestPasswordReset(email.trim().toLowerCase());
    if (ok) {
      setSubmitted(true);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Forgot password</h1>
          <p className="mt-1 text-sm text-white/50">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <div className="px-8 py-7">
          {submitted ? (
            <div className="rounded-md bg-success/10 px-4 py-4 text-sm text-success">
              A reset link has been sent to <strong>{email}</strong>.
            </div>
          ) : (
            <>
              {(authError || error) && (
                <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error || authError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-navy">Email address *</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-md border border-border bg-white px-4 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-md bg-gold py-3 text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
                >
                  {isAuthLoading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-navy-mid">
                Remember your password?{" "}
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
