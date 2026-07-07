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
  options?: { onCancellation?: (patientName: string) => void },
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

  // SSE subscription for the active session — keeps queue in sync without polling
  const sseCleanupRef = useRef<(() => void) | null>(null);
  const activeSessionRef = useRef<{ orgId: string; branchId: string; sessionId: string } | null>(null);

  function reloadQueue(orgIdArg: string, branchId: string, sessionId: string) {
    sessionService.getQueue(orgIdArg, branchId, sessionId)
      .then((q) => setQueue(q.appointments))
      .catch(() => { /* leave stale */ });
  }

  function ensureSSE(orgIdArg: string, branchId: string, sessionId: string) {
    const cur = activeSessionRef.current;
    if (cur && cur.orgId === orgIdArg && cur.branchId === branchId && cur.sessionId === sessionId) {
      return; // already subscribed
    }
    // Tear down old subscription
    sseCleanupRef.current?.();
    sseCleanupRef.current = null;

    const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
    const token = localStorage.getItem("waitless_access_token") ?? "";
    const url = `${apiBase}/orgs/${orgIdArg}/branches/${branchId}/sessions/${sessionId}/queue/sse?token=${encodeURIComponent(token)}`;
    const sse = new EventSource(url);
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; patientName?: string };
        if (data.type === "cancellation" && data.patientName) {
          options?.onCancellation?.(data.patientName);
        }
      } catch { /* malformed or comment event — ignore */ }
      reloadQueue(orgIdArg, branchId, sessionId);
    };
    activeSessionRef.current = { orgId: orgIdArg, branchId, sessionId };
    sseCleanupRef.current = () => { sse.close(); activeSessionRef.current = null; };
  }

  // Clean up SSE on unmount
  useEffect(() => {
    return () => { sseCleanupRef.current?.(); };
  }, []);

  const reload = useCallback(async () => {
    const currentBranches = branchesRef.current;
    // Wait until OrgContext has finished loading and we know the doctor's
    // membership ID. Both are required to match sessions correctly.
    // Do NOT setIsLoading(false) here — keep the skeleton visible while
    // context is still initializing so the user never sees a premature
    // "No active session today" flash before memberships have loaded.
    if (!orgId || currentBranches.length === 0 || !myMembershipId) {
      return;
    }
    // Only show the loading skeleton on the very first fetch; subsequent
    // background polls update in-place without flashing the spinner.
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      const today = todayString();
      // Fetch all branches in parallel — sequential was N × RTT per reload.
      const branchSessions = await Promise.all(
        currentBranches.map((branch) =>
          sessionService
            .getSessions(orgId, branch.id, { date: today })
            .then((sessions): { branch: { id: string }; sessions: BackendSession[] } => ({ branch, sessions }))
            .catch((): { branch: { id: string }; sessions: BackendSession[] } => ({ branch, sessions: [] })),
        ),
      );

      // Pick the doctor's session for today, preferring an actually-active one
      // over a merely-scheduled one in a different branch. A single pass that
      // takes the first (active-or-scheduled) match per branch would let a
      // not-yet-started session in an earlier branch hide a real active queue
      // in a later branch — so search all branches for 'active' first, and
      // only fall back to 'scheduled' if none of them have started yet.
      // s.doctorId is always the Membership ObjectId — never compare against
      // the Account ID (doctorAccountId), which is a different namespace.
      let found: BackendSession | undefined;
      let foundBranch: { id: string } | undefined;
      for (const { branch, sessions } of branchSessions) {
        const match = sessions.find((s) => s.status === "active" && s.doctorId === myMembershipId);
        if (match) { found = match; foundBranch = branch; break; }
      }
      if (!found) {
        for (const { branch, sessions } of branchSessions) {
          const match = sessions.find((s) => s.status === "scheduled" && s.doctorId === myMembershipId);
          if (match) { found = match; foundBranch = branch; break; }
        }
      }

      if (found && foundBranch) {
          setActiveSession(found);
          setActiveBranchId(foundBranch.id);
          ensureSSE(orgId, foundBranch.id, found.id);
          try {
            const q = await sessionService.getQueue(orgId, foundBranch.id, found.id);
            setQueue(q.appointments);
          } catch {
            // Leave stale queue data on transient error
          }
          return;
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
