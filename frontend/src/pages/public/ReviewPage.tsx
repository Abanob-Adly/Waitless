import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../../services/api";

async function fetchReviewByToken(token: string): Promise<{ doctorName: string } | null> {
  try {
    const res = await api.get<{ data: { reviewable: boolean; doctorName?: string; reason?: string } }>(
      `/reviews/submit?token=${token}`,
    );
    const d = res.data.data;
    if (!d.reviewable) {
      if (d.reason === "already_reviewed") throw Object.assign(new Error("already_reviewed"), { code: "already_reviewed" });
      return null;
    }
    return { doctorName: d.doctorName ?? "" };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "already_reviewed") throw err;
    return null;
  }
}

async function submitReview(token: string, rating: number, comment: string): Promise<{ ok: boolean }> {
  try {
    await api.post("/reviews/submit", { token, rating, comment: comment || undefined });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

type ReviewContext = {
  doctorName: string;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [context, setContext] = useState<ReviewContext | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenInvalid(true);
      setTokenLoading(false);
      return;
    }
    fetchReviewByToken(token)
      .then((ctx) => {
        if (!ctx) setTokenInvalid(true);
        else setContext(ctx);
        setTokenLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as { code?: string }).code === "already_reviewed") {
          setAlreadyReviewed(true);
        } else {
          setTokenInvalid(true);
        }
        setTokenLoading(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Please select a rating."); return; }
    setSubmitting(true);
    setError(null);
    const result = await submitReview(token, rating, comment.trim());
    if (result.ok) {
      setSubmitted(true);
    } else {
      setError("Failed to submit review. Please try again.");
    }
    setSubmitting(false);
  }

  if (tokenLoading) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite">
        <div className="flex items-center gap-2 text-navy-mid">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading…
        </div>
      </main>
    );
  }

  if (tokenInvalid) {
    return <StatusCard icon="🔗" title="Invalid Review Link" body="This review link is invalid or has expired." />;
  }

  if (alreadyReviewed) {
    return <StatusCard icon="✓" title="Already Reviewed" body="You have already submitted a review for this appointment." success />;
  }

  if (submitted) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-xl text-center">
          <div className="bg-navy px-8 py-7">
            <p className="font-heading text-sm font-medium text-gold">Waitless</p>
            <h1 className="mt-1 font-heading text-3xl font-bold text-white">Thank You!</h1>
          </div>
          <div className="px-8 py-10">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl">
              ⭐
            </div>
            <p className="font-heading text-xl font-bold text-navy">Review Submitted</p>
            <p className="mt-2 text-sm text-navy-mid">
              Your feedback helps other patients find great doctors.
            </p>
            <div className="mt-4 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={`text-2xl ${s <= rating ? "text-gold" : "text-border"}`}>★</span>
              ))}
            </div>
            <Link
              to="/"
              className="mt-6 inline-block rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
            >
              Back to Home →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Rate Your Visit</h1>
          {context && (
            <p className="mt-1 text-sm text-white/60">{context.doctorName}</p>
          )}
        </div>

        <div className="px-8 py-7">
          {error && (
            <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Star rating */}
            <div>
              <p className="text-sm font-medium text-navy">Your Rating *</p>
              <div className="mt-3 flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(0)}
                    className="animate-fade-up text-4xl transition-transform hover:scale-125 focus:outline-none active:scale-95"
                    style={{ animationDelay: `${i * 60}ms` }}
                    aria-label={`${s} star${s !== 1 ? "s" : ""}`}
                  >
                    <span className={`transition-colors duration-150 ${s <= (hovered || rating) ? "text-gold" : "text-border"}`}>
                      ★
                    </span>
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="mt-2 text-center text-xs text-navy-mid">
                  {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
                </p>
              )}
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-navy">
                Comment <span className="text-navy-mid">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 300))}
                placeholder="Share your experience…"
                rows={4}
                className="mt-1.5 w-full resize-none rounded-md border border-border bg-white px-4 py-3 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <p className="mt-1 text-right text-xs text-navy-mid">{comment.length}/300</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                "Submit Review →"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusCard({ icon, title, body, success = false }: { icon: string; title: string; body: string; success?: boolean }) {
  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-xl text-center">
        <div className="bg-navy px-8 py-7">
          <p className="font-heading text-sm font-medium text-gold">Waitless</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">{title}</h1>
        </div>
        <div className="px-8 py-10">
          <p className="text-5xl">{icon}</p>
          <p className={`mt-4 font-heading text-xl font-bold ${success ? "text-success" : "text-navy"}`}>{title}</p>
          <p className="mt-2 text-sm text-navy-mid">{body}</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
          >
            Go Home →
          </Link>
        </div>
      </div>
    </main>
  );
}
