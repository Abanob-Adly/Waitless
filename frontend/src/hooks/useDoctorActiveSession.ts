import { useState, useCallback } from "react";
import * as sessionService from "../services/sessionService";
import type { BackendSession, BackendAppointment } from "../services/sessionService";

type UseDoctorActiveSessionResult = {
  activeSession: BackendSession | null;
  activeBranchId: string;
  queue: BackendAppointment[];
  isLoading: boolean;
  reload: () => Promise<void>;
};

function todayString() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function useDoctorActiveSession(
  orgId: string,
  branches: { id: string }[],
  myMembershipId: string,
  doctorAccountId: string,
): UseDoctorActiveSessionResult {
  const [activeSession, setActiveSession] = useState<BackendSession | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string>("");
  const [queue, setQueue] = useState<BackendAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!orgId || branches.length === 0) return;
    setIsLoading(true);
    try {
      const today = todayString();
      for (const branch of branches) {
        const sessions = await sessionService.getSessions(orgId, branch.id, { date: today });
        const found = sessions.find(
          (s) =>
            (s.status === "active" || s.status === "scheduled") &&
            (s.doctorId === myMembershipId || s.doctorId === doctorAccountId),
        );
        if (found) {
          setActiveSession(found);
          setActiveBranchId(branch.id);
          try {
            const q = await sessionService.getQueue(orgId, branch.id, found.id);
            setQueue(q.appointments);
          } catch {
            setQueue([]);
          }
          setIsLoading(false);
          return;
        }
      }
      setActiveSession(null);
      setActiveBranchId("");
      setQueue([]);
    } catch {
      setActiveSession(null);
      setActiveBranchId("");
      setQueue([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, branches, myMembershipId, doctorAccountId]);

  return { activeSession, activeBranchId, queue, isLoading, reload };
}
