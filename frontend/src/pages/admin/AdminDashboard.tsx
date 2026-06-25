import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";
import { Tabs } from "../../components/ui/Tabs";
import type { Branch, Membership, DoctorBranchSchedule } from "../../types/index";

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
    { id: "billing", label: "Billing", content: <BillingTab /> },
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
  const { org, branches, memberships, subscription, plans, isLoading } = useOrg();

  if (isLoading) return <Skeleton />;

  const plan = plans.find((p) => p.id === subscription?.planId);
  const doctorCount = memberships.filter((m) => m.userRole === "doctor" && m.status === "active").length;
  const staffCount = memberships.filter((m) => m.status === "active").length;

  const trialDaysLeft = org?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

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

      {subscription?.status === "trial" && (
        <div className="rounded-xl border border-gold bg-gold-tint px-5 py-4">
          <p className="text-sm font-semibold text-navy">
            Free Trial — {trialDaysLeft} days remaining
          </p>
          <p className="mt-1 text-xs text-navy-mid">
            Upgrade to a paid plan to keep access after your trial ends.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-offwhite p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-mid">
          Organization
        </p>
        <p className="mt-2 font-heading text-lg font-bold text-navy">{org?.name}</p>
        <p className="text-sm text-navy-mid capitalize">{org?.type} · {org?.country} · {org?.timezone}</p>
        <p className="mt-1 text-xs text-navy-mid">
          {org?.isPublic ? "Listed on Marketplace" : "Private (not on Marketplace)"}
        </p>
      </div>
    </div>
  );
}

// ── Branches Tab ──────────────────────────────────────────────────────────────

function BranchesTab() {
  const { branches, isLoading, addBranch } = useOrg();
  const [showModal, setShowModal] = useState(false);

  if (isLoading) return <Skeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-mid">{branches.length} branch{branches.length !== 1 ? "es" : ""}</p>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          + Add Branch
        </button>
      </div>

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
            await addBranch(data);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab() {
  const { memberships, branches, isLoading, inviteStaff } = useOrg();
  const [showModal, setShowModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

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
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <InviteStaffModal
          branches={branches}
          onClose={() => setShowModal(false)}
          onSave={async (branchId, email, role, name) => {
            const token = await inviteStaff(branchId, email, role, name);
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
  const { schedules, memberships, branches, isLoading, createSchedule, addException } = useOrg();
  const [showAddModal, setShowAddModal] = useState(false);
  const [exceptionScheduleId, setExceptionScheduleId] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);

  if (isLoading) return <Skeleton />;

  const doctors = memberships.filter((m) => m.userRole === "doctor" && m.status === "active");
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
                <button
                  onClick={() => setExceptionScheduleId(s.id)}
                  className="text-xs font-medium text-danger hover:text-danger/70"
                >
                  Add Exception
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddScheduleModal
          doctors={doctors}
          branches={branches}
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => {
            const result = await createSchedule(data);
            setLastGenerated(result.sessionsGenerated ?? 0);
            setShowAddModal(false);
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

  if (isLoading) return <Skeleton />;

  async function handleUpgrade(planId: string) {
    setUpgrading(planId);
    setSuccess(null);
    await upgradePlan(planId);
    const plan = plans.find((p) => p.id === planId);
    setSuccess(`Upgraded to ${plan?.name ?? planId}`);
    setUpgrading(null);
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {success}
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
  onSave: (branchId: string, email: string, role: Membership["userRole"], name: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [role, setRole] = useState<Membership["userRole"]>("doctor");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !memberName.trim()) return;
    setSaving(true);
    await onSave(branchId, email.trim(), role, memberName.trim());
    setSaving(false);
  }

  return (
    <ModalShell title="Invite Staff Member" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <ModalField label="Full Name *" value={memberName} onChange={setMemberName} placeholder="Dr. Ahmed Ali" />
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
  onClose,
  onSave,
}: {
  doctors: Membership[];
  branches: Branch[];
  onClose: () => void;
  onSave: (data: Omit<DoctorBranchSchedule, "id">) => Promise<void>;
}) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.userId ?? "");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [fee, setFee] = useState("300");
  const [avgMin, setAvgMin] = useState("12");
  const [saving, setSaving] = useState(false);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [selectedDays, setSelectedDays] = useState<Record<number, { start: string; end: string }>>({
    1: { start: "09:00", end: "13:00" },
  });

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
    const doctor = doctors.find((d) => d.userId === doctorId);
    if (!doctor) return;
    setSaving(true);
    await onSave({
      doctorId,
      branchId,
      doctorName: doctor.memberName,
      specialty: "General Practice",
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
    <ModalShell title="Add Doctor Schedule" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        {doctors.length > 0 ? (
          <div>
            <label className="block text-sm font-medium text-navy">Doctor</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              {doctors.map((d) => (
                <option key={d.userId} value={d.userId}>{d.memberName}</option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-danger">No doctors found. Invite a doctor first.</p>
        )}

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

        <ModalActions onClose={onClose} saving={saving} label="Create Schedule" />
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
