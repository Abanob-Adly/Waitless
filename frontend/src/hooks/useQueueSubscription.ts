import { useState, useEffect } from "react";
import { fetchQueueStatus } from "../services/mockApi";

type QueueSubscriptionResult = {
  position: number;
  currentServing: number;
  etaMinutes: number;
  isCalled: boolean;
  isConnected: boolean;
};

export function useQueueSubscription(
  appointmentId: string,
  queueNumber: number,
  avgConsultationMin: number,
): QueueSubscriptionResult {
  const [currentServing, setCurrentServing] = useState(
    Math.max(0, queueNumber - 3),
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let alive = true;

    async function tick() {
      const data = await fetchQueueStatus(appointmentId, queueNumber);
      if (!alive) return;
      setCurrentServing(data.currentServing);
      setIsConnected(true);
    }

    tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [appointmentId, queueNumber]);

  const position = Math.max(0, queueNumber - currentServing);
  const isCalled = position === 0;
  // Corrected ETA: (position - 1) slots ahead × avg minutes per slot
  // position=1 → ETA=0 ("you're next"), position=3 → ETA=2*avg
  const etaMinutes = Math.max(0, (position - 1) * avgConsultationMin);

  return { position, currentServing, etaMinutes, isCalled, isConnected };
}
