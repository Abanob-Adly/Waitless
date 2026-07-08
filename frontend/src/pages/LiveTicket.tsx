import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useQueueSubscription } from "../hooks/useQueueSubscription";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../services/api";
import { startAppointmentCheckout } from "../services/paymentService";
import { fmt12 } from "../utils/time";
import type { ActiveBooking } from "../context/AppContext";

// ── Post-Consultation Rating Popup ────────────────────────────────────────────

function RatingPopup({ doctorName, reviewToken, onDismiss }: { doctorName: string; reviewToken: string; onDismiss: () => void }) {
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

// ── Page ──────────────────────────────────────────────────────────────────────

export function LiveTicket() {
  const { bookings, removeBooking } = useApp();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentResult = searchParams.get("payment");

  // Clear the query param after showing the banner
  useEffect(() => {
    if (paymentResult) {
      const timer = setTimeout(() => setSearchParams({}, { replace: true }), 5000);
      return () => clearTimeout(timer);
    }
  }, [paymentResult, setSearchParams]);

  // bookings[0] is always the earliest upcoming appointment (sorted by AppContext.addBooking)
  const booking = bookings[0] ?? null;

  return (
    <>
      {paymentResult === "success" && (
        <div className="bg-success px-4 py-3 text-center text-sm font-medium text-white">
          {t("Payment confirmed! Your appointment is secured.")}
        </div>
      )}
      {paymentResult === "failed" && (
        <div className="bg-danger px-4 py-3 text-center text-sm font-medium text-white">
          {t("Payment failed. Please try again or pay at the clinic.")}
        </div>
      )}
      {!booking
        ? <NoTicketView />
        : <TicketView
            booking={booking}
            onCancel={() => {
              removeBooking(booking.id);
              navigate("/");
            }}
          />
      }
    </>
  );
}

// ── Live ticket view ──────────────────────────────────────────────────────────

function TicketView({
  booking,
  onCancel,
}: {
  booking: ActiveBooking;
  onCancel: () => void;
}) {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);

  const trackingToken = booking.accessToken ?? booking.id;
  const [ratingDismissed, setRatingDismissed] = useState(false);
  const {
    position, currentServing, etaMinutes, globalDelayMin, avgConsultationMin,
    isCalled, isCompleted, isOnBreak, sessionDate, sessionStartTime, sessionStatus, reviewToken,
    emergencyReason, wasForceInserted, sessionClosureNote, appointmentStatus, isReady,
  } = useQueueSubscription(
    trackingToken,
    booking.queueNumber,
    booking.session.avgConsultationMin,
  );

  // "Pay at clinic" bookings sit outside the active queue until staff confirms
  // payment — position/currentServing are meaningless for it, so every
  // queue-position banner and view below must defer to this first.
  const isPendingConfirmation = appointmentStatus === "pending_confirmation";

  // Use booking's stored date as fallback until backend confirms sessionDate
  const effectiveDate = sessionDate || booking.session.date || "";
  const now = new Date();
  const todayLocal = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const isSessionDay = !effectiveDate || effectiveDate === todayLocal;

  // True when it's session day but the doctor hasn't started the session yet.
  // Uses the backend's real session status rather than guessing from wall-clock
  // time, so this stays accurate whether the session starts early, late, or on
  // schedule. Before the first poll resolves, sessionStatus is "" — treat that
  // as "not yet known" (false) rather than flashing a premature banner.
  const sessionNotStarted = isSessionDay && sessionStatus === "scheduled";

  // True when it's session day and the scheduled end time has already passed.
  // At this point the session window is over; if the patient wasn't served they
  // won't be — show a closed-session view instead of the queue position.
  const sessionWindowClosed = isSessionDay && (() => {
    const [hh, mm] = (booking.session.endTime ?? "00:00").split(":").map(Number);
    const scheduledEnd = new Date(`${effectiveDate || todayLocal}T00:00:00`);
    scheduledEnd.setHours(hh ?? 0, mm ?? 0, 0, 0);
    return scheduledEnd < now;
  })();

  // Recommended arrival time: now + EWT − 10 min buffer (arrive early)
  const recommendedArrivalMs = now.getTime() + etaMinutes * 60_000 - 10 * 60_000;
  const _arrivalDate = new Date(recommendedArrivalMs);
  const recommendedArrivalTime = fmt12(
    `${String(_arrivalDate.getHours()).padStart(2,"0")}:${String(_arrivalDate.getMinutes()).padStart(2,"0")}`,
    locale,
  );

  // Session start display from backend ISO string or booking fallback
  const _startRaw = sessionStartTime
    ? new Date(sessionStartTime).toISOString().slice(11, 16)
    : booking.session.startTime;
  const sessionStartDisplay = fmt12(_startRaw, locale);

  // SVG ring geometry — initialGap is fixed at 3 (hook starts 3 behind)
  const R = 68;
  const circumference = 2 * Math.PI * R;
  const initialGap = 3;
  const progress = initialGap > 0 ? 1 - position / initialGap : 1;
  const dashOffset = circumference * (1 - progress);

  // Clinic address from doctor clinics list
  const clinicDetails = booking.doctor.clinics.find(
    (c) => c.id === booking.session.clinicId,
  );

  const [launchingPayment, setLaunchingPayment] = useState(false);

  const isPaymobPending = booking.paymentMethod === "paymob" && booking.paymentStatus === "pending";

  const paymentBadge = isPaymobPending
    ? { label: t("Unpaid — Pay with Paymob"), cls: "bg-danger/10 text-danger" }
    : {
        success: { label: t("Paid ✓"), cls: "bg-success/10 text-success" },
        failed:  { label: t("Payment Failed"), cls: "bg-danger/10 text-danger" },
        pending: { label: t("Pay at Clinic"), cls: "bg-gold-tint text-navy" },
      }[booking.paymentStatus] ?? { label: booking.paymentStatus, cls: "bg-gold-tint text-navy" };

  async function handlePayWithPaymob() {
    setLaunchingPayment(true);
    try {
      const { checkoutUrl } = await startAppointmentCheckout(booking.id);
      window.location.assign(checkoutUrl);
    } catch {
      setLaunchingPayment(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm(t("Cancel your appointment? This cannot be undone.")))
      return;
    setCancelling(true);
    try {
      await api.delete(`/appointments/${booking.id}/cancel`);
      onCancel();
    } catch {
      setCancelling(false);
      window.alert(t("Failed to cancel your appointment. Please try again."));
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-8" dir={locale === "ar" ? "rtl" : "ltr"}>
      {isCompleted && reviewToken && !ratingDismissed && (
        <RatingPopup
          doctorName={booking.doctor.name}
          reviewToken={reviewToken}
          onDismiss={() => setRatingDismissed(true)}
        />
      )}

      <div className="mb-6 flex items-center justify-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isSessionDay ? "animate-pulse bg-success" : "bg-gold"}`} />
        <span className="text-sm text-navy-mid">
          {isSessionDay ? t("Live queue · syncing in real-time") : t("Appointment confirmed · awaiting session day")}
        </span>
      </div>

      {appointmentStatus === "no_show" && sessionClosureNote && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">🏥</span>
            <div className="flex-1">
              <p className="font-semibold text-navy">{t("Session Closed by Clinic")}</p>
              <p className="mt-1 text-sm text-navy-mid">{t(sessionClosureNote)}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="mt-4 w-full rounded-md border border-danger/30 py-2 text-sm font-medium text-danger transition hover:bg-danger/5"
          >
            {t("Remove Ticket")}
          </button>
        </div>
      )}

      {isSessionDay && isReady && !isPendingConfirmation && isOnBreak && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold-tint px-4 py-3">
          <span className="text-base">☕</span>
          <div>
            <p className="text-sm font-semibold text-navy">{t("Doctor is on a short break")}</p>
            <p className="mt-0.5 text-xs text-navy-mid">
              {t("Queue will resume shortly. Your estimated wait has been updated.")}
            </p>
          </div>
        </div>
      )}

      {isSessionDay && isReady && !isPendingConfirmation && !isOnBreak && globalDelayMin >= 5 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold-tint px-4 py-3">
          <span className="text-base">⏱</span>
          <p className="text-sm text-navy">
            <span className="font-semibold">{t("Doctor is running behind")}</span>{" "}
            — {t("estimated extra delay:")} {Math.round(globalDelayMin)} {t("min")}
          </p>
        </div>
      )}

      {isSessionDay && isReady && !isPendingConfirmation && wasForceInserted && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3">
          <span className="text-base">🚨</span>
          <div>
            <p className="text-sm font-semibold text-navy">{t("An emergency case was inserted ahead of you")}</p>
            {emergencyReason && (
              <p className="mt-0.5 text-xs text-navy-mid">{emergencyReason}</p>
            )}
          </div>
        </div>
      )}

      {isSessionDay && isReady && !isPendingConfirmation && !isCalled && position > 0 && position <= 3 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
          <span className="text-base">🔔</span>
          <div>
            <p className="text-sm font-semibold text-navy">
              {position === 1
                ? t("You're next!")
                : `${t("Almost your turn —")} ${position - 1} ${position - 1 > 1 ? t("patients ahead") : t("patient ahead")}`}
            </p>
            <p className="mt-0.5 text-xs text-navy-mid">
              {t("Please make your way to the clinic now.")}
            </p>
          </div>
        </div>
      )}

      {/* Ticket card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        {/* ── Navy header ── */}
        <div className="flex items-center justify-between bg-navy px-6 py-5">
          <div>
            <p className="font-heading text-xl font-bold text-white">
              {booking.doctor.name}
            </p>
            <p className="mt-0.5 text-sm text-white/60">
              {booking.doctor.specialty} · {booking.doctor.area}
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              {booking.session.clinicName}
            </p>
            {clinicDetails?.address && (
              <p className="mt-0.5 text-xs text-white/30">
                📍 {clinicDetails.address}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {t("Live")}
            </span>
            <p className="text-xs text-white/40">{booking.session.date}</p>
            <p className="text-xs text-white/40">
              {sessionStartDisplay} – {fmt12(booking.session.endTime, locale)}
            </p>
          </div>
        </div>

        {/* ── Queue position area ── */}
        <div className="px-6 pb-2 pt-6">
          {isSessionDay && !isReady ? (
            // Wait for the first poll response before deciding which view to
            // show — otherwise this briefly renders a guess from default/zero
            // state (e.g. WaitingView at position 0) that then flips to the
            // real view a moment later, which reads as the ticket "opening
            // early" and glitching shut.
            <TicketLoadingView />
          ) : isPendingConfirmation ? (
            <PendingConfirmationView fee={booking.doctor.fee} clinicName={booking.session.clinicName} />
          ) : !isSessionDay ? (
            <CountdownView sessionDate={effectiveDate} />
          ) : sessionNotStarted ? (
            <SessionNotStartedView
              startTime={booking.session.startTime}
              sessionDate={effectiveDate}
            />
          ) : sessionWindowClosed && !isCalled ? (
            <SessionWindowClosedView endTime={booking.session.endTime} />
          ) : isCalled ? (
            <CalledView />
          ) : (
            <WaitingView
              position={position}
              queueNumber={booking.queueNumber}
              currentServing={currentServing}
              etaMinutes={etaMinutes}
              avgConsultationMin={avgConsultationMin}
              recommendedArrivalTime={recommendedArrivalTime}
              circumference={circumference}
              dashOffset={dashOffset}
              R={R}
            />
          )}
        </div>

        {/* ── Payment + fee row ── */}
        <div className="mx-6 mb-2 rounded-lg border border-border bg-offwhite px-4 py-3">
          <div className="flex items-center justify-between">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge.cls}`}
            >
              {paymentBadge.label}
            </span>
            <span className="font-heading text-base font-bold text-navy">
              {booking.doctor.fee} EGP
            </span>
          </div>
          {isPaymobPending && (
            <button
              onClick={() => void handlePayWithPaymob()}
              disabled={launchingPayment}
              className="mt-2 w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-navy/80 disabled:opacity-60"
            >
              {launchingPayment ? t("Redirecting…") : t("Pay with Paymob →")}
            </button>
          )}
        </div>

        {/* ── Patient notes preview ── */}
        {booking.patientNotes && (
          <div className="mx-6 mb-2 rounded-lg bg-gold-tint px-4 py-2.5 text-xs text-navy-mid">
            <span className="font-medium text-navy">{t("Note:")} </span>
            {booking.patientNotes.slice(0, 80)}
            {booking.patientNotes.length > 80 ? "…" : ""}
          </div>
        )}

        {(isPendingConfirmation || (isSessionDay && !isCalled)) && (
          <div className="px-6 pb-6 pt-2">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full rounded-md border border-danger/30 bg-white py-3 text-sm font-medium text-danger transition hover:bg-danger hover:text-white disabled:opacity-50"
            >
              {cancelling ? t("Cancelling…") : t("Cancel My Booking")}
            </button>
          </div>
        )}

        <p className="pb-5 text-center text-xs text-navy-mid">
          {t("Keep this page open to track your position.")}
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-navy-mid">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-gold underline underline-offset-2 transition hover:text-gold-light"
        >
          {t("View in My Dashboard →")}
        </button>
      </p>
    </main>
  );
}

// ── Loading placeholder (shown until the first live poll resolves) ──────────

function TicketLoadingView() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-gold" />
    </div>
  );
}

// ── Pending confirmation view ("pay at clinic" not yet confirmed by staff) ──

function PendingConfirmationView({ fee, clinicName }: { fee: number; clinicName: string }) {
  const { t } = useLanguage();
  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gold-tint text-5xl">
        🏥
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        {t("Reserved — pay at reception")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-navy-mid">
        {t("Your spot is held, but you're not in the live queue yet.")}{" "}
        {t("Pay the")} <span className="font-semibold text-gold">{fee} EGP</span>{" "}
        {t("consultation fee at")} <span className="font-semibold text-navy">{clinicName}</span>{" "}
        {t("reception and staff will confirm it to add you to the queue.")}
      </p>
      <div className="mt-5 rounded-xl border border-gold/30 bg-gold-tint px-4 py-3 text-sm text-navy">
        {t("Your queue position and wait time will appear here once confirmed.")}
      </div>
    </div>
  );
}

// ── Session-not-started view (today but before start time / doctor hasn't pressed Start) ──

function SessionWindowClosedView({ endTime }: { endTime: string }) {
  const { t, locale } = useLanguage();
  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-danger/10 text-5xl">
        🔒
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">{t("Session Closed")}</h2>
      <p className="mt-3 text-sm leading-6 text-navy-mid">
        {t("This session ended at")}{" "}
        <span className="font-semibold text-navy">{fmt12(endTime, locale)}</span>.
      </p>
      <p className="mt-2 text-xs text-navy-mid">
        {t("If you were not seen, please contact the clinic to reschedule.")}
      </p>
      <div className="mt-5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
        {t("No further queue updates will be made for this session.")}
      </div>
    </div>
  );
}

function SessionNotStartedView({ startTime, sessionDate }: { startTime: string; sessionDate: string }) {
  const { t, locale } = useLanguage();
  const [, rerender] = useState(0);

  useEffect(() => {
    const id = setInterval(() => rerender((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const [hh, mm] = (startTime ?? "00:00").split(":").map(Number);
  const scheduledStart = new Date(`${sessionDate}T00:00:00`);
  scheduledStart.setHours(hh ?? 0, mm ?? 0, 0, 0);
  const diffMs = scheduledStart.getTime() - Date.now();
  const diffMin = Math.max(0, Math.round(diffMs / 60_000));
  const hours = Math.floor(diffMin / 60);
  const mins  = diffMin % 60;
  const countdownStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gold-tint text-5xl">
        ⏰
      </div>
      <h2 className="font-heading text-2xl font-bold text-navy">
        {t("Session starts in")} {countdownStr}
      </h2>
      <p className="mt-3 text-sm leading-6 text-navy-mid">
        {t("Your session is scheduled to begin at")}{" "}
        <span className="font-semibold text-navy">{fmt12(startTime, locale)}</span>.
      </p>
      <p className="mt-2 text-xs text-navy-mid">
        {t("Your queue position and wait time will appear here once the session begins.")}
      </p>
      <div className="mt-5 rounded-xl border border-gold/30 bg-gold-tint px-4 py-3 text-sm text-navy">
        {t("Arrive 10 minutes before your scheduled session.")}
      </div>
    </div>
  );
}

// ── Countdown view (appointment is in the future) ────────────────────────────

function CountdownView({ sessionDate }: { sessionDate: string }) {
  const { t, locale } = useLanguage();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const session = new Date(sessionDate + "T00:00:00");
  session.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((session.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const formatted = session.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gold-tint text-5xl">
        📅
      </div>
      <h2 className="font-heading text-3xl font-bold text-navy">
        {daysLeft <= 0 ? t("Today!") : daysLeft === 1 ? t("Tomorrow!") : `${daysLeft} ${t("days to go")}`}
      </h2>
      <p className="mt-4 text-sm leading-6 text-navy-mid">
        {t("Your appointment is scheduled for")}{" "}
        <span className="font-semibold text-navy">{formatted}</span>.
      </p>
      <p className="mt-2 text-xs text-navy-mid">
        {t("Return on the day of your appointment to track your live queue position.")}
      </p>
    </div>
  );
}

// ── Waiting view ──────────────────────────────────────────────────────────────

type WaitingViewProps = {
  position: number;
  queueNumber: number;
  currentServing: number;
  etaMinutes: number;
  avgConsultationMin: number;
  recommendedArrivalTime: string;
  circumference: number;
  dashOffset: number;
  R: number;
};

function WaitingView({
  position,
  queueNumber,
  currentServing,
  etaMinutes,
  avgConsultationMin,
  recommendedArrivalTime,
  circumference,
  dashOffset,
  R,
}: WaitingViewProps) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="mb-4 flex justify-center">
        <span className="rounded-full bg-navy px-4 py-1.5 text-sm font-medium text-white/70">
          {t("Your number:")}{" "}
          <span className="font-bold text-gold">#{queueNumber}</span>
        </span>
      </div>

      <p className="mb-4 text-center text-sm font-medium text-navy-mid">
        {t("Your position in queue")}
      </p>

      {/* SVG circular ring */}
      <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 180 180"
          aria-hidden="true"
        >
          <circle
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke="#DDD8CC"
            strokeWidth="10"
          />
          <circle
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke="#C9922A"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1.2s ease" }}
          />
        </svg>
        <div className="text-center">
          <span className="font-heading text-7xl font-bold leading-none text-navy">
            {position}
          </span>
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-navy-mid">
        {t("Currently serving")}{" "}
        <span className="font-semibold text-navy">#{currentServing}</span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gold-tint p-4 text-center">
          <p className="font-heading text-2xl font-bold text-gold">
            ~{etaMinutes}m
          </p>
          <p className="mt-1 text-xs font-medium text-navy-mid">
            {t("Estimated wait")}
          </p>
        </div>
        <div className="rounded-xl bg-offwhite p-4 text-center">
          <p className="font-heading text-2xl font-bold text-navy">
            {avgConsultationMin}m
          </p>
          <p className="mt-1 text-xs font-medium text-navy-mid">
            {t("Avg consultation")}
          </p>
        </div>
      </div>

      {etaMinutes > 10 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-offwhite px-4 py-3">
          <span className="text-base">📍</span>
          <div>
            <p className="text-xs font-medium text-navy">
              {t("Best time to arrive at the clinic")}
            </p>
            <p className="mt-0.5 font-heading text-lg font-bold text-gold">
              {recommendedArrivalTime}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Called view ───────────────────────────────────────────────────────────────

function CalledView() {
  const { t } = useLanguage();
  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-5 flex h-24 w-24 animate-bounce items-center justify-center rounded-full bg-gold-tint text-5xl">
        🔔
      </div>
      <h2 className="font-heading text-3xl font-bold text-navy">
        {t("It's your turn!")}
      </h2>
      <p className="mt-4 text-sm leading-6 text-navy-mid">
        {t("Please proceed to reception within")}{" "}
        <span className="font-semibold text-gold">{t("5 minutes")}</span>{" "}
        {t("or your spot may be given to the next patient.")}
      </p>
      <div className="mt-6 rounded-xl bg-gold-tint px-5 py-4">
        <p className="font-medium text-navy">
          {t("Show this screen at the reception desk")}
        </p>
        <p className="mt-1 text-xs text-navy-mid">
          {t("Reception staff will note your details")}
        </p>
      </div>
    </div>
  );
}

// ── No ticket view ────────────────────────────────────────────────────────────

function NoTicketView() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-md px-6 py-28 text-center" dir={locale === "ar" ? "rtl" : "ltr"}>
      <p className="text-6xl">🎫</p>
      <h2 className="mt-5 font-heading text-3xl font-bold text-navy">
        {t("No active ticket")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-navy-mid">
        {t("You don't have an active booking. Find a doctor and book an appointment to receive your live queue ticket.")}
      </p>
      <button
        onClick={() => navigate("/search")}
        className="mt-8 rounded-md bg-gold px-8 py-3 text-sm font-medium text-navy transition hover:bg-gold-light"
      >
        {t("Find a Doctor")}
      </button>
    </main>
  );
}
