import { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../services/api";

export function RatingPopup({
  doctorName,
  reviewToken,
  onDismiss,
}: {
  doctorName: string;
  reviewToken: string;
  onDismiss: () => void;
}) {
  const { t, locale } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await api.post(`/reviews/submit`, { token: reviewToken, rating, comment: comment.trim() || undefined });
      setSubmitted(true);
      setTimeout(onDismiss, 2000);
    } catch {
      onDismiss();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-4 pb-8 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm animate-fade-up rounded-2xl bg-white p-6 shadow-2xl" dir={locale === "ar" ? "rtl" : "ltr"}>
        {submitted ? (
          <div className="py-4 text-center">
            <p className="text-4xl">⭐</p>
            <p className="mt-3 font-heading text-lg font-bold text-navy">{t("Thank you!")}</p>
            <p className="mt-1 text-sm text-navy-mid">{t("Your feedback helps improve care.")}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-center">
              <p className="text-3xl">🩺</p>
              <h3 className="mt-2 font-heading text-lg font-bold text-navy">{t("Rate Your Consultation")}</h3>
              <p className="mt-1 text-sm text-navy-mid">{t("How was your experience with")} {doctorName}?</p>
            </div>

            <div className="mb-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                >
                  <span className={(hovered || rating) >= star ? "text-gold" : "text-border"}>★</span>
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional comment…"
              rows={3}
              className="w-full resize-none rounded-md border border-border px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={onDismiss}
                className="flex-1 rounded-md border border-border py-2.5 text-sm text-navy-mid hover:border-navy hover:text-navy"
              >
                {t("Skip")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="flex-1 rounded-md bg-gold py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-50"
              >
                {submitting ? t("Sending…") : t("Submit Rating")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
