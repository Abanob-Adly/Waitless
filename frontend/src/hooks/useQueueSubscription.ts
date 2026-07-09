import { useState, useEffect } from "react";
import { api } from "../services/api";

type QueueSubscriptionResult = {
  position: number;
  currentServing: number;
  etaMinutes: number;
  globalDelayMin: number;
  avgConsultationMin: number;
  isCalled: boolean;
  isCompleted: boolean;
  isConnected: boolean;
  isReady: boolean;
  isOnBreak: boolean;
  sessionDate: string;
  sessionStartTime: string;
  sessionStatus: string;
  appointmentStatus: string;
  sessionClosureNote: string | null;
  reviewToken: string | null;
  emergencyReason: string | null;
  wasForceInserted: boolean;
};

/**
 * Subscribes to the public queue tracking endpoint via SSE for real-time
 * updates, re-fetching only when the server actually pushes a change —
 * not on a fixed timer. Falls back to 30s polling only if the SSE
 * connection can't be established after retries (matches the pattern in
 * pages/queue/LiveTicket.tsx). This used to poll unconditionally every 3
 * seconds, which — combined with each request's cost — made the ticket
 * page feel like it was constantly reloading.
 * `trackingToken` is the accessToken returned when an appointment is booked.
 */
export function useQueueSubscription(
  trackingToken: string,
  queueNumber: number,
  avgConsultationMinFallback: number,
): QueueSubscriptionResult {
  const [currentServing, setCurrentServing] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [globalDelayMin, setGlobalDelayMin] = useState(0);
  const [avgConsultationMin, setAvgConsultationMin] = useState(avgConsultationMinFallback);
  const [appointmentStatus, setAppointmentStatus] = useState("");
  const [reviewToken, setReviewToken] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState<string | null>(null);
  const [wasForceInserted, setWasForceInserted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  // Set once, on the first successful response, and never unset — lets callers
  // avoid rendering a view guessed from default/zero state before real data
  // arrives (which briefly shows the wrong screen, then flips — a visible
  // glitch). Deliberately separate from `isConnected`, which toggles on every
  // transient poll failure and would otherwise cause the same flicker later.
  const [isReady, setIsReady] = useState(false);
  const [sessionClosureNote, setSessionClosureNote] = useState<string | null>(null);
  const [positionFromServer, setPositionFromServer] = useState<number | null>(null);

  useEffect(() => {
    if (!trackingToken) return;
    let alive = true;

    async function tick() {
      try {
        const res = await api.get<{
          data: {
            queueNumber: number;
            currentlyServing: number;
            estimatedWaitMin: number;
            position?: number;
            globalDelayMin?: number;
            avgConsultationMin?: number;
            status: string;
            sessionClosureNote?: string | null;
            sessionDate?: string;
            sessionStartTime?: string;
            sessionStatus?: string;
            isOnBreak?: boolean;
            reviewToken?: string | null;
            emergencyReason?: string | null;
            wasForceInserted?: boolean;
          };
        }>(`/appointments/track/${trackingToken}`);

        if (!alive) return;
        const d = res.data.data;
        setCurrentServing(d.currentlyServing ?? 0);
        if (d.position != null) setPositionFromServer(d.position);
        setEtaMinutes(d.estimatedWaitMin ?? 0);
        setGlobalDelayMin(d.globalDelayMin ?? 0);
        if (d.avgConsultationMin != null) setAvgConsultationMin(d.avgConsultationMin);
        setAppointmentStatus(d.status ?? "");
        if (d.reviewToken != null) setReviewToken(d.reviewToken);
        if (d.sessionDate) setSessionDate(d.sessionDate);
        if (d.sessionStartTime) setSessionStartTime(d.sessionStartTime);
        if (d.sessionStatus) setSessionStatus(d.sessionStatus);
        setIsOnBreak(d.isOnBreak ?? false);
        setEmergencyReason(d.emergencyReason ?? null);
        setWasForceInserted(d.wasForceInserted ?? false);
        if (d.sessionClosureNote !== undefined) setSessionClosureNote(d.sessionClosureNote ?? null);
        setIsConnected(true);
        setIsReady(true);
      } catch {
        if (!alive) return;
        setIsConnected(false);
      }
    }

    tick();

    // SSE for real-time updates. Retries up to 3 times with 3/6/9s backoff
    // before falling back to 30s polling.
    const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
    const sseUrl = `${apiBase}/appointments/track/${trackingToken}/sse`;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let retries = 0;
    let currentSSE: EventSource | null = null;

    function connectSSE() {
      const es = new EventSource(sseUrl);
      currentSSE = es;
      es.onopen = () => { retries = 0; };
      es.onmessage = () => { void tick(); };
      es.onerror = () => {
        es.close();
        if (!alive) return;
        if (retries < 3) {
          retries++;
          setTimeout(() => { if (alive) connectSSE(); }, retries * 3_000);
        } else if (!fallbackInterval) {
          fallbackInterval = setInterval(() => { void tick(); }, 30_000);
        }
      };
    }

    connectSSE();

    return () => {
      alive = false;
      currentSSE?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [trackingToken]);

  const position = positionFromServer ?? Math.max(1, queueNumber - currentServing);

  // Guard against false positive: 0 >= 0 is true but means "not yet loaded"
  const isCalled =
    (currentServing > 0 && currentServing >= queueNumber) ||
    appointmentStatus === "called" ||
    appointmentStatus === "in_progress";

  // Use server-provided ETA when available, otherwise compute locally
  const computedEta =
    etaMinutes > 0
      ? etaMinutes
      : Math.max(0, (position - 1) * avgConsultationMin);

  const isCompleted = appointmentStatus === "completed";

  return {
    position,
    currentServing,
    etaMinutes: computedEta,
    globalDelayMin,
    avgConsultationMin,
    isCalled,
    isCompleted,
    isConnected,
    isReady,
    isOnBreak,
    sessionDate,
    sessionStartTime,
    sessionStatus,
    appointmentStatus,
    sessionClosureNote,
    reviewToken,
    emergencyReason,
    wasForceInserted,
  };
}
