import { useNavigate } from "react-router-dom";
import type { SubscriptionPlan, Subscription } from "../../types/index";

type LimitType = "doctor" | "receptionist" | "branch";

type Props = {
  open: boolean;
  onClose: () => void;
  limitType: LimitType | null;
  subscription: Subscription | null;
  plans: SubscriptionPlan[];
};

const LIMIT_COPY: Record<LimitType, { title: string; description: string }> = {
  doctor: {
    title: "Doctor Limit Reached",
    description:
      "You've reached the maximum number of doctors allowed on your current plan. Upgrade to add more doctors to your organization.",
  },
  receptionist: {
    title: "Receptionist Limit Reached",
    description:
      "You've reached the maximum number of receptionists allowed on your current plan. Upgrade to add more staff.",
  },
  branch: {
    title: "Branch Limit Reached",
    description:
      "You've reached the maximum number of branches allowed on your current plan. Upgrade to expand to more locations.",
  },
};

export function UpgradeModal({ open, onClose, limitType, subscription, plans }: Props) {
  const navigate = useNavigate();

  if (!open || !limitType) return null;

  const copy = LIMIT_COPY[limitType];
  const currentPlan = plans.find((p) => p.id === subscription?.planId);
  const nextPlans = plans.filter(
    (p) => p.pricePerMonth > (currentPlan?.pricePerMonth ?? 0),
  );

  function handleUpgrade() {
    onClose();
    navigate("/admin?tab=billing");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md animate-fade-up rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <span className="inline-block rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
              Plan Limit
            </span>
            <h2 className="mt-2 font-heading text-xl font-bold text-navy">{copy.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-md p-1 text-navy-mid transition hover:text-navy"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-navy-mid">{copy.description}</p>

        {/* Current plan */}
        {currentPlan && (
          <div className="mt-4 rounded-xl border border-border bg-offwhite px-4 py-3">
            <p className="text-xs text-navy-mid">Current plan</p>
            <p className="font-heading text-base font-bold text-navy">{currentPlan.name}</p>
            <p className="text-sm text-navy-mid">
              {limitType === "doctor" && `Up to ${currentPlan.maxDoctors} doctors`}
              {limitType === "receptionist" && `Up to ${currentPlan.maxDoctors} staff`}
              {limitType === "branch" && `Up to ${currentPlan.maxBranches} branch${currentPlan.maxBranches === 1 ? "" : "es"}`}
            </p>
          </div>
        )}

        {/* Next plan previews */}
        {nextPlans.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-mid">
              Available upgrades
            </p>
            {nextPlans.slice(0, 2).map((plan) => (
              <div key={plan.id} className="rounded-xl border border-gold/40 bg-gold-tint px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-heading font-bold text-navy">{plan.name}</p>
                  <p className="text-sm font-semibold text-gold">
                    {plan.pricePerMonth === 0 ? "Contact sales" : `${plan.pricePerMonth} EGP/mo`}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-navy-mid">
                  {limitType === "doctor" && (plan.maxDoctors == null ? "Unlimited doctors" : `Up to ${plan.maxDoctors} doctors`)}
                  {limitType === "receptionist" && (plan.maxDoctors == null ? "Unlimited staff" : `Up to ${plan.maxDoctors} staff`)}
                  {limitType === "branch" && (plan.maxBranches == null ? "Unlimited branches" : `Up to ${plan.maxBranches} branches`)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-2.5 text-sm font-medium text-navy-mid transition hover:border-navy hover:text-navy"
          >
            Dismiss
          </button>
          <button
            onClick={handleUpgrade}
            className="flex-1 rounded-md bg-gold py-2.5 text-sm font-medium text-navy transition hover:bg-gold-light"
          >
            View Plans &amp; Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
