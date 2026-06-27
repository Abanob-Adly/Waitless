import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";
import { Tabs } from "../../components/ui/Tabs";
import type { Branch, Membership, DoctorBranchSchedule } from "../../types/index";
import * as sessionService from "../../services/sessionService";
import type { BackendSession } from "../../services/sessionService";

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { authUser, logout } = useAuth();
  const navigate = useNavigate();
  const { org, isLoading } = useOrg();

  if (!authUser || authUser.role !== "admin") {
    navigate("/login", { replace: true });
    return null;
  }

  const admin = authUser.profile;

  const tabs = [
    { id: "overview", label: "Overview", content: <OverviewTab /> },
    { id: "branches", label: "Branches", content: <BranchesTab /> },
    { id: "staff", label: "Staff", content: <StaffTab /> },
    { id: "schedules", label: "Schedules", content: <SchedulesTab /> },
    { id: "sessions", label: "Sessions", content: <SessionsTab /> },
    { id: "billing", label: "Billing", content: <BillingTab /> },
    { id: "whatsapp", label: "WhatsApp", content: <WhatsAppTab /> },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex animate-fade-up items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gold">Admin Portal</p>
          <h1 className="font-heading text-4xl font-bold text-navy">
            {isLoading ? "Loading…" : org?.name ?? "Your Organization"}
          </h1>
          <p className="mt-1 text-sm text-navy-mid">
            {admin.name} · Administrator
          </p>
        </div>
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="rounded-md border border-border px-4 py-2 text-sm text-navy-mid transition hover:border-danger/40 hover:text-danger"
        >
          Sign Out
        </button>
      </div>

      <section className="animate-fade-up rounded-xl border border-border bg-white p-6 shadow-sm" style={{ animationDelay: "100ms" }}>
        <Tabs items={tabs} defaultTab="overview" />
      </section>
    </main>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { org, branches, memberships, subscription, plans, isLoading, toggleVisibility } = useOrg();
  const [toggling, setToggling] = useState(false);
  const [visResult, setVisResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (isLoading) return <Skeleton />;

  const plan = plans.find((p) => p.id === subscription?.planId);
  const doctorCount = memberships.filter((m) => m.userRole === "doctor" && m.status === "active").length;
  const staffCount = memberships.filter((m) => m.status === "active").length;

  async function handleToggle() {
    if (!org?.isPublic && !plan?.marketplaceListing) {
      setVisResult({
        ok: false,
        msg: "Your current plan does not include marketplace listing. Upgrade to Standard or Enterprise.",
      });
      return;
    }
    setToggling(true);
    setVisResult(null);
    const result = await toggleVisibility(!org?.isPublic);
    setVisResult({
      ok: result.ok,
      msg: result.ok
        ? (org?.isPublic ? "Organization removed from marketplace." : "Organization is now listed on the marketplace.")
        : (result.error ?? "Failed to update visibility."),
    });
    setToggling(false);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          <StatBox key="br" label="Branches" value={branches.length.toString()} />,
          <StatBox key="dr" label="Doctors" value={doctorCount.toString()} />,
          <StatBox key="st" label="Total Staff" value={staffCount.toString()} accent />,
          <StatBox key="pl" label="Plan" value={plan?.name ?? "—"} success />,
        ].map((box, i) => (
          <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            {box}
          </div>
        ))}
      </div>

      {branches.length === 0 && (
        <div className="rounded-xl border border-gold bg-gold-tint px-5 py-4">
          <p className="text-sm font-semibold text-navy">Add your first branch to get started</p>
          <p className="mt-1 text-xs text-navy-mid">
            Doctors, schedules, and sessions all require a branch. Head to the Branches tab to add one.
          </p>
        </div>
      )}

      {subscription?.status === "trial" && branches.length > 0 && (
        <div className="rounded-xl border border-gold bg-gold-tint px-5 py-4">
          <p className="text-sm font-semibold text-navy">
            Free Trial
          </p>
          <p className="mt-1 text-xs text-navy-mid">
            Upgrade to a paid plan to unlock marketplace listing and more features.
          </p>
        </div>
      )}

      {visResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${visResult.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"}`}>
          {visResult.msg}
        </div>
      )}

      <div className="rounded-xl border border-border bg-offwhite p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-mid">
          Organization
        </p>
        <p className="mt-2 font-heading text-lg font-bold text-navy">{org?.name}</p>
        <p className="text-sm text-navy-mid capitalize">{org?.type}</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-navy-mid">Marketplace Listing</p>
            <p className="mt-0.5 text-xs text-navy-mid">
              {org?.isPublic ? "Visible to patients" : "Not listed publicly"}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              org?.isPublic
                ? "border border-border text-navy-mid hover:border-danger/40 hover:text-danger"
                : "bg-gold text-navy hover:bg-gold-light"
            }`}
          >
            {toggling ? "Saving…" : org?.isPublic ? "Make Private" : "List Publicly →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Branches Tab ──────────────────────────────────────────────────────────────

function BranchesTab() {
  const { branches, isLoading, addBranch } = useOrg();
  const [showModal, setShowModal] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  if (isLoading) return <Skeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-mid">{branches.length} branch{branches.length !== 1 ? "es" : ""}</p>
        <button
          onClick={() => { setShowModal(true); setBranchError(null); }}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          + Add Branch
        </button>
      </div>

      {branchError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {branchError}
        </div>
      )}

      {branches.length === 0 ? (
        <EmptyState icon="🏢" title="No branches yet" body="Add your first branch to get started." />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-navy">{b.name}</p>
                <p className="text-sm text-navy-mid">{b.address}, {b.city}</p>
                <p className="text-xs text-navy-mid">{b.phone}</p>
              </div>
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                Active
              </span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddBranchModal
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            const result = await addBranch(data);
            if (result.ok) {
              setBranchError(null);
              setShowModal(false);
            } else {
              setBranchError(result.error ?? "Failed to add branch.");
              setShowModal(false);
            }
          }}
        />
      )}
    </div>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab() {
  const { memberships, branches, isLoading, inviteStaff, removeMember } = useOrg();
  const [showModal, setShowModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(memberId: string, memberName: string) {
    if (!window.confirm(`Remove ${memberName || "this staff member"}? This cannot be undone.`)) return;
    setRemoving(memberId);
    await removeMember(memberId);
    setRemoving(null);
  }

  if (isLoading) return <Skeleton />;

  const roleColors: Record<string, string> = {
    admin: "bg-navy/10 text-navy",
    doctor: "bg-gold-tint text-gold",
    receptionist: "bg-success/10 text-success",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-mid">{memberships.length} member{memberships.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => { setShowModal(true); setGeneratedToken(null); }}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          + Invite Staff
        </button>
      </div>

      {generatedToken && (
        <div className="rounded-xl border border-gold bg-gold-tint p-4">
          <p className="text-xs font-semibold text-navy">Invitation link (share with invitee):</p>
          <p className="mt-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-navy-mid">
            {window.location.origin}/accept-invite?token={generatedToken}
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${generatedToken}`)}
            className="mt-2 text-xs font-medium text-gold hover:text-gold-light"
          >
            Copy link →
          </button>
        </div>
      )}

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {memberships.map((m) => {
          const branch = branches.find((b) => b.id === m.branchId);
          return (
            <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="font-medium text-navy">{m.memberName}</p>
                <p className="text-xs text-navy-mid">{m.invitedEmail}</p>
                {branch && <p className="text-xs text-navy-mid">{branch.name}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[m.userRole] ?? "bg-border text-navy-mid"}`}>
                  {m.userRole}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.status === "active" ? "bg-success/10 text-success" : "bg-gold-tint text-gold"
                }`}>
                  {m.status}
                </span>
                <button
                  onClick={() => handleRemove(m.id, m.memberName)}
                  disabled={removing === m.id}
                  className="text-xs font-medium text-danger hover:text-danger/70 disabled:opacity-40"
                >
                  {removing === m.id ? "…" : "Remove"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <InviteStaffModal
          branches={branches}
          onClose={() => setShowModal(false)}
          onSave={async (branchId, email, role, specialties, permissions) => {
            const token = await inviteStaff(branchId, email, role, specialties, permissions);
            if (token) setGeneratedToken(token);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── Schedules Tab ─────────────────────────────────────────────────────────────

function SchedulesTab() {
  const { schedules, memberships, branches, isLoading, createSchedule, updateSchedule, addException } = useOrg();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DoctorBranchSchedule | null>(null);
  const [exceptionScheduleId, setExceptionScheduleId] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);

  if (isLoading) return <Skeleton />;

  const doctors = memberships.filter((m) => m.userRole === "doctor");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-mid">{schedules.length} schedule{schedules.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          + Add Schedule
        </button>
      </div>

      {lastGenerated !== null && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Schedule created — {lastGenerated} session{lastGenerated !== 1 ? "s" : ""} generated for the next 14 days.
        </div>
      )}

      {schedules.length === 0 ? (
        <EmptyState icon="📅" title="No schedules yet" body="Add a doctor's weekly schedule to auto-generate sessions." />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {schedules.map((s) => {
            const branch = branches.find((b) => b.id === s.branchId);
            return (
              <div key={s.id} className="flex items-start justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-navy">{s.doctorName}</p>
                  <p className="text-sm text-navy-mid">{s.specialty} · {branch?.name ?? s.branchId}</p>
                  <p className="mt-1 text-xs text-navy-mid">
                    {s.weeklySlots.map((slot) => `${days[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}`).join(", ")}
                  </p>
                  <p className="text-xs text-navy-mid">
                    {s.fee} EGP · {s.avgConsultationMin} min avg
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    onClick={() => setEditingSchedule(s)}
                    className="text-xs font-medium text-gold hover:text-gold-light"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setExceptionScheduleId(s.id)}
                    className="text-xs font-medium text-danger hover:text-danger/70"
                  >
                    Add Exception
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddScheduleModal
          doctors={doctors}
          branches={branches}
          schedules={schedules}
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => {
            const result = await createSchedule(data);
            setLastGenerated(result.sessionsGenerated ?? 0);
            setShowAddModal(false);
          }}
        />
      )}

      {editingSchedule && (
        <AddScheduleModal
          doctors={doctors}
          branches={branches}
          schedules={schedules}
          initialValues={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSave={async (data) => {
            await updateSchedule(editingSchedule.id, data);
            setEditingSchedule(null);
          }}
        />
      )}

      {exceptionScheduleId && (
        <ScheduleExceptionModal
          onClose={() => setExceptionScheduleId(null)}
          onSave={async (date, reason) => {
            await addException(exceptionScheduleId, date, reason);
            setExceptionScheduleId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Billing Tab ───────────────────────────────────────────────────────────────

function BillingTab() {
  const { subscription, plans, isLoading, upgradePlan } = useOrg();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <Skeleton />;

  async function handleUpgrade(planId: string) {
    setUpgrading(planId);
    setSuccess(null);
    setError(null);
    const ok = await upgradePlan(planId);
    const plan = plans.find((p) => p.id === planId);
    if (ok) {
      setSuccess(`Plan upgraded to ${plan?.name ?? planId}. Changes take effect immediately.`);
    } else {
      setError("Failed to upgrade plan. Please try again.");
    }
    setUpgrading(null);
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = subscription?.planId === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 transition ${
                isCurrent ? "border-gold bg-gold-tint" : "border-border bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading text-lg font-bold text-navy">{plan.name}</p>
                  <p className="mt-0.5 text-2xl font-bold text-gold">
                    {plan.pricePerMonth === 0
                      ? plan.tier === "trial" ? "Free" : "Contact Us"
                      : `${plan.pricePerMonth} EGP`}
                    {plan.pricePerMonth > 0 && (
                      <span className="text-sm font-normal text-navy-mid">/mo</span>
                    )}
                  </p>
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-navy">
                    Current
                  </span>
                )}
              </div>

              <ul className="mt-3 space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-navy-mid">
                    <span className="text-success">✓</span> {f}
                  </li>
                ))}
              </ul>

              {!isCurrent && plan.tier !== "enterprise" && (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading === plan.id}
                  className="mt-4 w-full rounded-md border border-navy px-4 py-2 text-sm font-medium text-navy transition hover:bg-navy hover:text-white disabled:opacity-60"
                >
                  {upgrading === plan.id ? "Upgrading…" : "Select Plan"}
                </button>
              )}
              {!isCurrent && plan.tier === "enterprise" && (
                <button className="mt-4 w-full rounded-md border border-navy px-4 py-2 text-sm font-medium text-navy transition hover:bg-navy hover:text-white">
                  Contact Sales
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── WhatsApp Tab ──────────────────────────────────────────────────────────────

function WhatsAppTab() {
  const { org, subscription, plans, isLoading, updateOrg } = useOrg();
  const [number, setNumber] = useState(org?.whatsappNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (isLoading) return <Skeleton />;

  const plan = plans.find((p) => p.id === subscription?.planId);
  const hasWhatsApp = Boolean(plan?.whatsappNotifications);

  if (!hasWhatsApp) {
    return (
      <div className="rounded-xl bg-offwhite py-12 text-center">
        <p className="text-3xl">💬</p>
        <p className="mt-3 font-heading text-lg font-bold text-navy">WhatsApp Notifications</p>
        <p className="mt-1 text-sm text-navy-mid">
          Your current plan does not include WhatsApp notifications.
        </p>
        <p className="mt-1 text-sm text-navy-mid">
          Upgrade to Standard or Enterprise to enable this feature.
        </p>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    const r = await updateOrg({ whatsappNumber: number.trim() || null });
    setResult({ ok: r.ok, msg: r.ok ? "WhatsApp number saved." : (r.error ?? "Failed to save.") });
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy-mid">
        Set a WhatsApp number to send automated appointment reminders to patients.
      </p>

      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"}`}>
          {result.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <ModalField
          label="WhatsApp Number (E.164 format)"
          value={number}
          onChange={setNumber}
          placeholder="+201XXXXXXXXX"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold px-6 py-2 text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Number"}
        </button>
      </form>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function AddBranchModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: Omit<Branch, "id" | "orgId">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), address: address.trim(), city: city.trim(), phone: phone.trim() });
    setSaving(false);
  }

  return (
    <ModalShell title="Add Branch" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <ModalField label="Branch Name *" value={name} onChange={setName} placeholder="Maadi Branch" />
        <ModalField label="Address *" value={address} onChange={setAddress} placeholder="15 Road 9, Maadi" />
        <ModalField label="City *" value={city} onChange={setCity} placeholder="Cairo" />
        <ModalField label="Phone" value={phone} onChange={setPhone} placeholder="02-XXXXXXXX" inputMode="numeric" />
        <ModalActions onClose={onClose} saving={saving} label="Add Branch" />
      </form>
    </ModalShell>
  );
}

function InviteStaffModal({
  branches,
  onClose,
  onSave,
}: {
  branches: Branch[];
  onClose: () => void;
  onSave: (branchId: string, email: string, role: Membership["userRole"], specialties?: string[], permissions?: string[]) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Membership["userRole"]>("doctor");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [specialties, setSpecialties] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function togglePermission(perm: string) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    const specialtiesArr = role === "doctor" && specialties.trim()
      ? specialties.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const permissionsArr = role === "admin" && permissions.length > 0 ? permissions : undefined;
    await onSave(branchId, email.trim(), role, specialtiesArr, permissionsArr);
    setSaving(false);
  }

  return (
    <ModalShell title="Invite Staff Member" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <ModalField label="Email Address *" value={email} onChange={setEmail} placeholder="staff@clinic.eg" type="email" />

        <div>
          <label className="block text-sm font-medium text-navy">Role</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(["doctor", "receptionist", "admin"] as Membership["userRole"][]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md border py-2 text-xs font-medium capitalize transition ${
                  role === r ? "border-navy bg-navy text-white" : "border-border text-navy-mid hover:border-navy/40"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {role === "doctor" && (
          <ModalField
            label="Specialties (comma-separated)"
            value={specialties}
            onChange={setSpecialties}
            placeholder="Cardiology, Internal Medicine"
          />
        )}

        {role === "admin" && (
          <div>
            <p className="text-sm font-medium text-navy">Permissions</p>
            <div className="mt-1.5 space-y-1.5">
              {["members.manage", "schedules.manage", "billing.view"].map((perm) => (
                <label key={perm} className="flex cursor-pointer items-center gap-2 text-sm text-navy-mid">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm)}
                    onChange={() => togglePermission(perm)}
                    className="rounded border-border"
                  />
                  {perm}
                </label>
              ))}
            </div>
          </div>
        )}

        {role !== "admin" && branches.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-navy">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <ModalActions onClose={onClose} saving={saving} label="Send Invitation" />
      </form>
    </ModalShell>
  );
}

function AddScheduleModal({
  doctors,
  branches,
  schedules,
  initialValues,
  onClose,
  onSave,
}: {
  doctors: Membership[];
  branches: Branch[];
  schedules: DoctorBranchSchedule[];
  initialValues?: DoctorBranchSchedule;
  onClose: () => void;
  onSave: (data: Omit<DoctorBranchSchedule, "id">) => Promise<void>;
}) {
  const isEditMode = initialValues !== undefined;
  const [branchId, setBranchId] = useState(initialValues?.branchId ?? branches[0]?.id ?? "");

  // In add mode, hide doctors who already have an active schedule for the selected branch
  const availableDoctors = isEditMode
    ? doctors
    : doctors.filter((d) => !schedules.some((s) => s.doctorId === d.id && s.branchId === branchId));

  const [doctorId, setDoctorId] = useState(initialValues?.doctorId ?? availableDoctors[0]?.id ?? "");
  const [specialty, setSpecialty] = useState(initialValues?.specialty ?? "General Practice");
  const [fee, setFee] = useState(String(initialValues?.fee ?? "300"));
  const [avgMin, setAvgMin] = useState(String(initialValues?.avgConsultationMin ?? "12"));
  const [saving, setSaving] = useState(false);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [selectedDays, setSelectedDays] = useState<Record<number, { start: string; end: string }>>(
    initialValues?.weeklySlots.length
      ? Object.fromEntries(initialValues.weeklySlots.map((s) => [s.dayOfWeek, { start: s.startTime, end: s.endTime }]))
      : { 1: { start: "09:00", end: "13:00" } },
  );

  function toggleDay(idx: number) {
    setSelectedDays((prev) => {
      const next = { ...prev };
      if (next[idx]) {
        delete next[idx];
      } else {
        next[idx] = { start: "09:00", end: "13:00" };
      }
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const foundDoctor = doctors.find((d) => d.id === doctorId);
    if (!isEditMode && !foundDoctor) return;
    const doctorDisplayName = foundDoctor?.memberName ?? initialValues?.doctorName ?? "";
    setSaving(true);
    await onSave({
      doctorId, // membership ID
      branchId,
      doctorName: doctorDisplayName,
      specialty,
      weeklySlots: Object.entries(selectedDays).map(([dow, times]) => ({
        dayOfWeek: Number(dow),
        startTime: times.start,
        endTime: times.end,
      })),
      fee: Number(fee),
      avgConsultationMin: Number(avgMin),
      isActive: true,
    });
    setSaving(false);
  }

  return (
    <ModalShell title={isEditMode ? "Edit Doctor Schedule" : "Add Doctor Schedule"} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        {!isEditMode && (
          <div>
            <label className="block text-sm font-medium text-navy">Branch</label>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setDoctorId("");
              }}
              className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {!isEditMode && (
          availableDoctors.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-navy">Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                {availableDoctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.memberName || d.invitedEmail}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-danger">All doctors already have a schedule for this branch.</p>
          )
        )}

        <ModalField
          label="Specialty"
          value={specialty}
          onChange={setSpecialty}
          placeholder="e.g. Cardiology"
        />

        <div>
          <label className="block text-sm font-medium text-navy">Weekly Days</label>
          <div className="mt-1.5 grid grid-cols-7 gap-1">
            {days.map((day, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`rounded-md py-2 text-xs font-medium transition ${
                  selectedDays[i] ? "bg-navy text-white" : "border border-border text-navy-mid hover:border-navy/40"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
          {Object.entries(selectedDays).map(([dow, times]) => (
            <div key={dow} className="mt-2 flex items-center gap-2 text-xs">
              <span className="w-8 text-navy-mid">{days[Number(dow)]}</span>
              <input
                type="time"
                value={times.start}
                onChange={(e) => setSelectedDays((p) => ({ ...p, [dow]: { ...times, start: e.target.value } }))}
                className="rounded border border-border px-2 py-1 text-xs"
              />
              <span>–</span>
              <input
                type="time"
                value={times.end}
                onChange={(e) => setSelectedDays((p) => ({ ...p, [dow]: { ...times, end: e.target.value } }))}
                className="rounded border border-border px-2 py-1 text-xs"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Fee (EGP)" value={fee} onChange={setFee} placeholder="300" inputMode="numeric" />
          <ModalField label="Avg. Min / Patient" value={avgMin} onChange={setAvgMin} placeholder="12" inputMode="numeric" />
        </div>

        <ModalActions onClose={onClose} saving={saving} label={isEditMode ? "Save Changes" : "Create Schedule"} />
      </form>
    </ModalShell>
  );
}

function ScheduleExceptionModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (date: string, reason: string) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    await onSave(date, reason.trim() || "Unavailable");
    setSaving(false);
  }

  return (
    <ModalShell title="Add Schedule Exception" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-navy">Date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>
        <ModalField label="Reason" value={reason} onChange={setReason} placeholder="Sick leave, training, etc." />
        <div className="rounded-md bg-gold-tint px-4 py-3 text-xs text-navy-mid">
          The session on this date will be closed and affected patients will be notified.
        </div>
        <ModalActions onClose={onClose} saving={saving} label="Add Exception" />
      </form>
    </ModalShell>
  );
}

// ── Sessions Tab ─────────────────────────────────────────────────────────────

function SessionsTab() {
  const { org, branches } = useOrg();
  const orgId = org?.id ?? "";

  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMax, setEditingMax] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Default to first branch
  useEffect(() => {
    if (branches.length > 0 && !branchId) setBranchId(branches[0].id);
  }, [branches, branchId]);

  useEffect(() => {
    if (!orgId || !branchId) return;
    setIsLoading(true);
    sessionService
      .getSessions(orgId, branchId, { date })
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setIsLoading(false));
  }, [orgId, branchId, date]);

  async function handleSaveMax(session: BackendSession) {
    const raw = editingMax[session.id];
    if (raw === undefined) return;
    const parsed = raw.trim() === "" ? null : parseInt(raw, 10);
    if (raw.trim() !== "" && (isNaN(parsed!) || parsed! < 1)) return;
    setSaving(session.id);
    try {
      const updated = await sessionService.updateSession(orgId, session.branchId, session.id, {
        maxBookings: parsed,
      });
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingMax((prev) => {
        const next = { ...prev };
        delete next[session.id];
        return next;
      });
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  }

  const statusBadge: Record<string, string> = {
    scheduled: "bg-gold-tint text-gold",
    active:    "bg-success/10 text-success",
    ended:     "bg-border text-navy-mid",
    cancelled: "bg-danger/10 text-danger",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
      </div>

      {isLoading ? (
        <Skeleton />
      ) : sessions.length === 0 ? (
        <EmptyState icon="📅" title="No sessions" body="No sessions found for this branch and date." />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {sessions.map((session) => {
            const isEditing = editingMax[session.id] !== undefined;
            const maxVal = isEditing ? editingMax[session.id] : (session as BackendSession & { maxBookings?: number | null }).maxBookings != null ? String((session as BackendSession & { maxBookings?: number | null }).maxBookings) : "";
            return (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium text-navy">{session.doctorName || "Doctor"}</p>
                  <p className="mt-0.5 text-sm text-navy-mid">
                    {session.startTime} – {session.endTime}
                  </p>
                  <p className="text-xs text-navy-mid">{session.bookingsCount} booked</p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Max slots editor */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-navy-mid">Max slots</label>
                    <input
                      type="number"
                      min={1}
                      value={isEditing ? editingMax[session.id] : maxVal}
                      placeholder="∞"
                      onChange={(e) => setEditingMax((prev) => ({ ...prev, [session.id]: e.target.value }))}
                      className="h-8 w-20 rounded-md border border-border bg-white px-2 text-sm text-navy outline-none focus:border-gold"
                    />
                    {isEditing && (
                      <button
                        onClick={() => handleSaveMax(session)}
                        disabled={saving === session.id}
                        className="rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
                      >
                        {saving === session.id ? "…" : "Save"}
                      </button>
                    )}
                  </div>

                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge[session.status] ?? ""}`}>
                    {session.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared modal primitives ───────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 animate-fade-in bg-navy/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-navy px-6 py-4">
          <p className="font-heading text-lg font-bold text-white">{title}</p>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
    </label>
  );
}

function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="flex h-10 w-full items-center justify-center rounded-md border border-border text-sm text-navy-mid transition hover:border-navy hover:text-navy"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="flex h-10 w-full items-center justify-center rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
      >
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function StatBox({ label, value, accent = false, success = false }: { label: string; value: string; accent?: boolean; success?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 text-center">
      <p className={`font-heading text-3xl font-bold ${accent ? "text-gold" : success ? "text-success" : "text-navy"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-navy-mid">{label}</p>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-offwhite py-12 text-center">
      <p className="text-4xl">{icon}</p>
      <p className="mt-3 font-heading text-lg font-bold text-navy">{title}</p>
      <p className="mt-1 text-sm text-navy-mid">{body}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2 py-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-offwhite" />
      ))}
    </div>
  );
}
