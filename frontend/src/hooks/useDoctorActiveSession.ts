import { useState, useCallback, useRef } from "react";
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
  _doctorAccountId: string,
): UseDoctorActiveSessionResult {
  const [activeSession, setActiveSession] = useState<BackendSession | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string>("");
  const [queue, setQueue] = useState<BackendAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Tracks whether we've received the first successful response. Background
  // polls after that update data silently without re-showing the spinner.
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    // Wait until OrgContext has finished loading and we know the doctor's
    // membership ID. Both are required to match sessions correctly.
    if (!orgId || branches.length === 0 || !myMembershipId) {
      setIsLoading(false);
      return;
    }
    // Only show the loading skeleton on the very first fetch; subsequent
    // background polls update in-place without flashing the spinner.
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      const today = todayString();
      for (const branch of branches) {
        const sessions = await sessionService.getSessions(orgId, branch.id, { date: today });
        // s.doctorId is always the Membership ObjectId — never compare against
        // the Account ID (doctorAccountId), which is a different namespace.
        const found = sessions.find(
          (s) =>
            (s.status === "active" || s.status === "scheduled") &&
            s.doctorId === myMembershipId,
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
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  // doctorAccountId intentionally omitted — it is the Account ID and must not
  // be used to match sessions (session.doctor is always a Membership ObjectId).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, branches, myMembershipId]);

  return { activeSession, activeBranchId, queue, isLoading, reload };
}
