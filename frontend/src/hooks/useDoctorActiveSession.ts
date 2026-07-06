import { useState, useCallback, useRef, useEffect } from "react";
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
  // Keep branches in a ref so useCallback identity stays stable even when the
  // OrgContext array reference changes between renders. Without this, every
  // context re-render produces a new `reload` function → the useEffect in
  // QueueTab/ManageQueueTab fires → interval resets → visible flicker.
  const branchesRef = useRef(branches);
  useEffect(() => { branchesRef.current = branches; }, [branches]);

  const reload = useCallback(async () => {
    const currentBranches = branchesRef.current;
    // Wait until OrgContext has finished loading and we know the doctor's
    // membership ID. Both are required to match sessions correctly.
    if (!orgId || currentBranches.length === 0 || !myMembershipId) {
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
      for (const branch of currentBranches) {
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
            // Leave stale queue data on transient error
          }
          return;
        }
      }
      // No active session found — clear state so UI reflects reality.
      setActiveSession(null);
      setActiveBranchId("");
      setQueue([]);
    } catch {
      // Leave stale data on transient network/server errors to avoid flicker.
      if (!hasLoadedRef.current) {
        setActiveSession(null);
        setActiveBranchId("");
        setQueue([]);
      }
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  // branches read from ref — excluded from deps intentionally to keep identity
  // stable. doctorAccountId also omitted — it is the Account ID and must not
  // be used to match sessions (session.doctor is always a Membership ObjectId).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, myMembershipId]);

  return { activeSession, activeBranchId, queue, isLoading, reload };
}
