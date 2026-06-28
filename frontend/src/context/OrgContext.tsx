import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import * as orgService from "../services/orgService";
import { UpgradeModal } from "../components/ui/UpgradeModal";
import type {
  Organization,
  Branch,
  Membership,
  DoctorBranchSchedule,
  Subscription,
  SubscriptionPlan,
} from "../types/index";

// ── Context type ──────────────────────────────────────────────────────────────

type LimitType = "doctor" | "receptionist" | "branch";

type OrgCtx = {
  org: Organization | null;
  branches: Branch[];
  memberships: Membership[];
  schedules: DoctorBranchSchedule[];
  subscription: Subscription | null;
  plans: SubscriptionPlan[];
  isLoading: boolean;
  myRoles: Array<Membership["userRole"]>;
  upgradeModal: { limitType: LimitType } | null;
  clearUpgradeModal: () => void;
  refresh: () => Promise<void>;
  addBranch: (data: Omit<Branch, "id" | "orgId">) => Promise<{ ok: boolean; error?: string }>;
  inviteStaff: (
    branchId: string,
    email: string,
    role: Membership["userRole"],
    specialties?: string[],
    permissions?: string[],
  ) => Promise<string | null>;
  removeMember: (memberId: string) => Promise<boolean>;
  updateMember: (memberId: string, data: {
    kind?: Membership["userRole"];
    specialties?: string[];
    bio?: string;
    permissions?: string[];
    websiteUrl?: string | null;
    acceptedInsurances?: string[];
    licenseNumber?: string;
    yearsOfExperience?: number | null;
    languagesSpoken?: string[];
  }) => Promise<boolean>;
  createSchedule: (
    data: Omit<DoctorBranchSchedule, "id">,
  ) => Promise<{ ok: boolean; sessionsGenerated?: number }>;
  updateSchedule: (
    scheduleId: string,
    data: Omit<DoctorBranchSchedule, "id" | "doctorId" | "branchId" | "doctorName" | "specialty" | "isActive">,
  ) => Promise<boolean>;
  addException: (
    scheduleId: string,
    date: string,
    reason: string,
  ) => Promise<boolean>;
  upgradePlan: (planId: string) => Promise<boolean>;
  toggleVisibility: (isPublic: boolean) => Promise<{ ok: boolean; error?: string }>;
  updateOrg: (data: { name?: string; whatsappNumber?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  grantAdmin: (memberId: string) => Promise<boolean>;
  revokeAdmin: (memberId: string) => Promise<boolean>;
};

const OrgContext = createContext<OrgCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { authUser } = useAuth();

  const orgId =
    authUser?.role === "admin" || authUser?.role === "receptionist" || authUser?.role === "doctor"
      ? (authUser.profile as { orgId?: string }).orgId ?? null
      : null;

  const [org, setOrg] = useState<Organization | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [schedules, setSchedules] = useState<DoctorBranchSchedule[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [upgradeModal, setUpgradeModal] = useState<{ limitType: LimitType } | null>(null);

  const myAccountId = (authUser?.profile as { id?: string } | undefined)?.id ?? "";
  const myRoles = memberships
    .filter((m) => m.userId === myAccountId && m.status === "active")
    .map((m) => m.userRole);

  function clearUpgradeModal() { setUpgradeModal(null); }

  function detectLimitError(err: unknown): LimitType | null {
    const msg: string =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
    if (/doctor limit/i.test(msg))       return "doctor";
    if (/receptionist limit/i.test(msg)) return "receptionist";
    if (/branch limit/i.test(msg))       return "branch";
    return null;
  }

  async function refresh() {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [o, b, m, s, p] = await Promise.all([
        orgService.getOrg(orgId),
        orgService.getBranches(orgId),
        orgService.getMembers(orgId),
        orgService.getSchedules(orgId),
        orgService.getPlans(),
      ]);
      setOrg(o);
      setBranches(b);
      setMemberships(m);
      setSchedules(s);
      setPlans(p);
      // Subscription is optional — 404 means no active plan yet
      try {
        const sub = await orgService.getSubscription(orgId);
        setSubscription(sub);
      } catch {
        setSubscription(null);
      }
    } catch (err) {
      console.error("OrgContext refresh error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function addBranch(
    data: Omit<Branch, "id" | "orgId">,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!orgId) return { ok: false, error: "No organization loaded" };
    try {
      const branch = await orgService.createBranch(orgId, {
        name: data.name,
        address: data.address ? { street: data.address, city: data.city } : undefined,
        phone: data.phone,
      });
      setBranches((prev) => [...prev, branch]);
      return { ok: true };
    } catch (err) {
      const limitType = detectLimitError(err);
      if (limitType) { setUpgradeModal({ limitType }); return { ok: false }; }
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Failed to add branch.";
      console.error("addBranch error:", err);
      return { ok: false, error: msg };
    }
  }

  async function inviteStaff(
    branchId: string,
    email: string,
    role: Membership["userRole"],
    specialties?: string[],
    permissions?: string[],
  ): Promise<string | null> {
    if (!orgId) return null;
    try {
      const result = await orgService.inviteMember(orgId, {
        email,
        kind:        role as "admin" | "doctor" | "receptionist",
        branches:    role === "receptionist" ? [branchId] : undefined,
        specialties: role === "doctor"       ? specialties : undefined,
        permissions: role === "admin"        ? permissions  : undefined,
      });
      await refresh();
      return result.token;
    } catch (err) {
      const limitType = detectLimitError(err);
      if (limitType) { setUpgradeModal({ limitType }); return null; }
      console.error("inviteStaff error:", err);
      return null;
    }
  }

  async function createSchedule(
    data: Omit<DoctorBranchSchedule, "id">,
  ): Promise<{ ok: boolean; sessionsGenerated?: number }> {
    if (!orgId) return { ok: false };
    try {
      const result = await orgService.createSchedule(orgId, {
        doctorMembershipId: data.doctorId,
        branchId:           data.branchId,
        schedule:           data.weeklySlots,
        avgConsultationMin: data.avgConsultationMin,
        consultationFee:    data.fee,
      });
      setSchedules((prev) => [...prev, result.schedule]);
      return { ok: true, sessionsGenerated: result.sessionsGenerated };
    } catch (err) {
      console.error("createSchedule error:", err);
      return { ok: false };
    }
  }

  async function updateSchedule(
    scheduleId: string,
    data: Omit<DoctorBranchSchedule, "id" | "doctorId" | "branchId" | "doctorName" | "specialty" | "isActive">,
  ): Promise<boolean> {
    if (!orgId) return false;
    try {
      const updated = await orgService.updateSchedule(orgId, scheduleId, {
        schedule:           data.weeklySlots,
        avgConsultationMin: data.avgConsultationMin,
        consultationFee:    data.fee,
      });
      setSchedules((prev) => prev.map((s) => s.id === scheduleId ? { ...s, ...updated } : s));
      return true;
    } catch (err) {
      console.error("updateSchedule error:", err);
      return false;
    }
  }

  async function addException(
    scheduleId: string,
    date: string,
    reason: string,
  ): Promise<boolean> {
    if (!orgId) return false;
    try {
      await orgService.addException(orgId, scheduleId, { date, reason });
      return true;
    } catch (err) {
      console.error("addException error:", err);
      return false;
    }
  }

  async function upgradePlan(planId: string): Promise<boolean> {
    if (!orgId) return false;
    try {
      const sub = await orgService.upgradePlan(orgId, planId);
      if (sub) {
        setSubscription(sub);
        return true;
      }
      return false;
    } catch (err) {
      console.error("upgradePlan error:", err);
      return false;
    }
  }

  async function toggleVisibility(isPublic: boolean): Promise<{ ok: boolean; error?: string }> {
    if (!orgId) return { ok: false, error: "No organization loaded" };
    const result = await orgService.toggleVisibility(orgId, isPublic);
    if (result.ok) {
      setOrg((prev) => prev ? { ...prev, isPublic } : prev);
    }
    return result;
  }

  async function removeMember(memberId: string): Promise<boolean> {
    if (!orgId) return false;
    try {
      await orgService.revokeMember(orgId, memberId);
      setMemberships((prev) => prev.filter((m) => m.id !== memberId));
      return true;
    } catch (err) {
      console.error("removeMember error:", err);
      return false;
    }
  }

  async function updateMember(
    memberId: string,
    data: { kind?: Membership["userRole"]; specialties?: string[]; bio?: string; permissions?: string[] },
  ): Promise<boolean> {
    if (!orgId) return false;
    try {
      await orgService.updateMember(orgId, memberId, data);
      await refresh();
      return true;
    } catch (err) {
      console.error("updateMember error:", err);
      return false;
    }
  }

  async function updateOrg(data: { name?: string; whatsappNumber?: string | null }): Promise<{ ok: boolean; error?: string }> {
    if (!orgId) return { ok: false, error: "No organization loaded" };
    try {
      const updated = await orgService.updateOrg(orgId, data);
      setOrg(updated);
      return { ok: true };
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Failed to update organization.";
      return { ok: false, error: msg };
    }
  }

  async function grantAdmin(memberId: string): Promise<boolean> {
    if (!orgId) return false;
    const ok = await orgService.grantMemberAdmin(orgId, memberId);
    if (ok) await refresh();
    return ok;
  }

  async function revokeAdmin(memberId: string): Promise<boolean> {
    if (!orgId) return false;
    const ok = await orgService.revokeMemberAdmin(orgId, memberId);
    if (ok) await refresh();
    return ok;
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
        myRoles,
        upgradeModal,
        clearUpgradeModal,
        refresh,
        addBranch,
        inviteStaff,
        removeMember,
        updateMember,
        createSchedule,
        updateSchedule,
        addException,
        upgradePlan,
        toggleVisibility,
        updateOrg,
        grantAdmin,
        revokeAdmin,
      }}
    >
      {children}
      <UpgradeModal
        open={upgradeModal !== null}
        onClose={clearUpgradeModal}
        limitType={upgradeModal?.limitType ?? null}
        subscription={subscription}
        plans={plans}
      />
    </OrgContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrg(): OrgCtx {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside <OrgProvider>");
  return ctx;
}
