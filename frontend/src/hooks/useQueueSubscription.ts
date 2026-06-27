import { useState, useEffect } from "react";
import { api } from "../services/api";

type QueueSubscriptionResult = {
  position: number;
  currentServing: number;
  etaMinutes: number;
  isCalled: boolean;
  isConnected: boolean;
};

/**
 * Polls the public queue tracking endpoint every 3 seconds.
 * `trackingToken` is the accessToken returned when an appointment is booked.
 * Falls back to appointmentId-based polling if no token is provided.
 */
export function useQueueSubscription(
  trackingToken: string,
  queueNumber: number,
  avgConsultationMin: number,
): QueueSubscriptionResult {
  const [currentServing, setCurrentServing] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [appointmentStatus, setAppointmentStatus] = useState("");
  const [isConnected, setIsConnected] = useState(false);

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
            status: string;
          };
        }>(`/appointments/track/${trackingToken}`);

        if (!alive) return;
        const d = res.data.data;
        setCurrentServing(d.currentlyServing ?? 0);
        setEtaMinutes(d.estimatedWaitMin ?? 0);
        setAppointmentStatus(d.status ?? "");
        setIsConnected(true);
      } catch {
        if (!alive) return;
        setIsConnected(false);
      }
    }

    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [trackingToken]);

  const position = Math.max(1, queueNumber - currentServing);
  const isCalled =
    currentServing >= queueNumber ||
    appointmentStatus === "called" ||
    appointmentStatus === "in_progress";

  // Use server-provided ETA when available, otherwise compute locally
  const computedEta =
    etaMinutes > 0
      ? etaMinutes
      : Math.max(0, (position - 1) * avgConsultationMin);

  return {
    position,
    currentServing,
    etaMinutes: computedEta,
    isCalled,
    isConnected,
  };
}
