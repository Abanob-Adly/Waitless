import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import {
  fetchOrgById,
  fetchBranches,
  fetchMemberships,
  fetchSchedules,
  fetchSubscription,
  fetchSubscriptionPlans,
  addBranch as apiAddBranch,
  inviteStaff as apiInviteStaff,
  createDoctorSchedule,
  addScheduleException,
  updateSubscription as apiUpdateSubscription,
} from "../services/mockApi";
import type {
  Organization,
  Branch,
  Membership,
  DoctorBranchSchedule,
  Subscription,
  SubscriptionPlan,
} from "../types/index";

// ── Context type ──────────────────────────────────────────────────────────────

type OrgCtx = {
  org: Organization | null;
  branches: Branch[];
  memberships: Membership[];
  schedules: DoctorBranchSchedule[];
  subscription: Subscription | null;
  plans: SubscriptionPlan[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addBranch: (data: Omit<Branch, "id" | "orgId">) => Promise<boolean>;
  inviteStaff: (
    branchId: string,
    email: string,
    role: Membership["userRole"],
    name: string,
  ) => Promise<string | null>;
  createSchedule: (data: Omit<DoctorBranchSchedule, "id">) => Promise<{ ok: boolean; sessionsGenerated?: number }>;
  addException: (
    scheduleId: string,
    date: string,
    reason: string,
  ) => Promise<boolean>;
  upgradePlan: (planId: string) => Promise<boolean>;
};

const OrgContext = createContext<OrgCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { authUser } = useAuth();

  const orgId =
    authUser?.role === "admin" || authUser?.role === "receptionist"
      ? authUser.profile.orgId
      : null;

  const [org, setOrg] = useState<Organization | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [schedules, setSchedules] = useState<DoctorBranchSchedule[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [o, b, m, s, sub, p] = await Promise.all([
      fetchOrgById(orgId),
      fetchBranches(orgId),
      fetchMemberships(orgId),
      fetchSchedules(orgId),
      fetchSubscription(orgId),
      fetchSubscriptionPlans(),
    ]);
    setOrg(o);
    setBranches(b);
    setMemberships(m);
    setSchedules(s);
    setSubscription(sub);
    setPlans(p);
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function addBranch(data: Omit<Branch, "id" | "orgId">): Promise<boolean> {
    if (!orgId) return false;
    const result = await apiAddBranch(orgId, data);
    if (result.success && result.branch) {
      setBranches((prev) => [...prev, result.branch!]);
    }
    return result.success;
  }

  async function inviteStaff(
    branchId: string,
    email: string,
    role: Membership["userRole"],
    name: string,
  ): Promise<string | null> {
    if (!orgId) return null;
    const result = await apiInviteStaff(orgId, branchId, email, role, name);
    if (result.success && result.token) {
      await refresh();
      return result.token;
    }
    return null;
  }

  async function createSchedule(
    data: Omit<DoctorBranchSchedule, "id">,
  ): Promise<{ ok: boolean; sessionsGenerated?: number }> {
    const result = await createDoctorSchedule(data);
    if (result.success && result.schedule) {
      setSchedules((prev) => [...prev, result.schedule!]);
    }
    return { ok: result.success, sessionsGenerated: result.sessionsGenerated };
  }

  async function addException(
    scheduleId: string,
    date: string,
    reason: string,
  ): Promise<boolean> {
    const result = await addScheduleException(scheduleId, date, reason);
    return result.success;
  }

  async function upgradePlan(planId: string): Promise<boolean> {
    if (!orgId) return false;
    const result = await apiUpdateSubscription(orgId, planId);
    if (result.success && result.subscription) {
      setSubscription(result.subscription);
    }
    return result.success;
  }

  return (
    <OrgContext.Provider
      value={{
        org,
        branches,
        memberships,
        schedules,
        subscription,
        plans,
        isLoading,
        refresh,
        addBranch,
        inviteStaff,
        createSchedule,
        addException,
        upgradePlan,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrg(): OrgCtx {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside <OrgProvider>");
  return ctx;
}
