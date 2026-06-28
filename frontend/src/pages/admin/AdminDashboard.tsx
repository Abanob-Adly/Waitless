import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";
import type { Branch, Membership, DoctorBranchSchedule } from "../../types/index";
import * as sessionService from "../../services/sessionService";
import type { BackendSession } from "../../services/sessionService";
import * as orgService from "../../services/orgService";
import type { WalletSummary, WalletTransaction } from "../../services/orgService";
import * as jr from "../../services/joinRequestService";
import type { AdminJoinRequest } from "../../services/joinRequestService";

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminSection = "overview" | "branches" | "staff" | "joinrequests" | "schedules" | "sessions" | "wallet" | "billing" | "whatsapp" | "settings";

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { authUser, logout } = useAuth();
  const navigate = useNavigate();
  const { org, isLoading, myRoles, branches, memberships, schedules } = useOrg();
  const [activeSection, setActiveSection] = useState<AdminSection | null>(null);

  if (!authUser || (authUser.role !== "admin" && authUser.role !== "doctor")) {
    navigate("/login", { replace: true });
    return null;
  }

  const admin = authUser.profile as { id: string; name: string; orgId: string };
  const initials = admin.name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  const isAlsoDoctor = myRoles.includes("doctor");
  const staffCount  = memberships.filter((m) => m.status === "active").length;

  const sectionTitle: Record<AdminSection, string> = {
    overview: "Overview", branches: "Branches", staff: "Staff",
    joinrequests: "Join Requests",
    schedules: "Schedules", sessions: "Sessions", wallet: "Wallet",
    billing: "Billing", whatsapp: "WhatsApp", settings: "Settings",
  };

  function renderSection() {
    switch (activeSection) {
      case "overview":  return <OverviewTab />;
      case "branches":  return <BranchesTab />;
      case "staff":        return <StaffTab />;
      case "joinrequests": return <JoinRequestsTab />;
      case "schedules": return <SchedulesTab />;
      case "sessions":  return <SessionsTab />;
      case "wallet":    return <WalletTab />;
      case "billing":   return <BillingTab />;
      case "whatsapp":  return <WhatsAppTab />;
      case "settings":  return <SettingsTab />;
      default: return null;
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">

      {/* Header */}
      <div className="mb-8 flex animate-fade-up flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold font-heading text-base font-bold text-navy">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">Admin</span>
              {isAlsoDoctor && (
                <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">Doctor</span>
              )}
            </div>
            <h1 className="mt-0.5 truncate font-heading text-2xl font-bold text-navy sm:text-3xl">
              {isLoading ? "Loading…" : org?.name ?? "Your Organization"}
            </h1>
            <p className="truncate text-sm text-navy-mid">{admin.name}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Wallet — isolated nav item */}
          <button
            onClick={() => setActiveSection(activeSection === "wallet" ? null : "wallet")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeSection === "wallet"
                ? "bg-gold text-navy shadow-sm"
                : "border border-gold/30 text-gold hover:bg-gold/5"
            }`}
          >
            <IconWallet />
            <span className="hidden sm:inline">Wallet</span>
          </button>

          {isAlsoDoctor && (
            <button
              onClick={() => navigate("/doctor-dashboard")}
              className="hidden items-center gap-1.5 rounded-lg border border-navy/20 bg-navy/5 px-3 py-2 text-sm font-medium text-navy transition hover:bg-navy/10 sm:flex"
            >
              <IconQueue />
              <span>My Queue</span>
            </button>
          )}

          <button
            onClick={() => { logout(); navigate("/"); }}
            className="rounded-lg border border-border px-3 py-2 text-sm text-navy-mid transition hover:border-danger/40 hover:text-danger"
          >
            <span className="hidden sm:inline">Sign Out</span>
            <span className="inline sm:hidden">✕</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      {activeSection && (
        <div className="mb-5 flex items-center gap-2 text-sm">
          <button onClick={() => setActiveSection(null)} className="text-navy-mid transition hover:text-navy">
            ← Dashboard
          </button>
          <span className="text-navy-mid/40">/</span>
          <span className="font-medium text-navy">{sectionTitle[activeSection]}</span>
        </div>
      )}

      {/* Body */}
      {activeSection ? (
        <section className="animate-fade-up rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
          {renderSection()}
        </section>
      ) : (
        <DashboardHome
          branchCount={branches.length}
          staffCount={staffCount}
          scheduleCount={schedules.length}
          isAlsoDoctor={isAlsoDoctor}
          onSelect={setActiveSection}
          onDoctorView={() => navigate("/doctor-dashboard")}
        />
      )}
    </main>
  );
}

// ── Dashboard Home (card grid) ───────────────────────────────────────────────

type CardTheme = "navy" | "gold" | "success";

type CardDef = {
  id: AdminSection;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  theme: CardTheme;
};

function DashboardHome({
  branchCount, staffCount, scheduleCount,
  isAlsoDoctor, onSelect, onDoctorView,
}: {
  branchCount: number;
  staffCount: number;
  scheduleCount: number;
  isAlsoDoctor: boolean;
  onSelect: (s: AdminSection) => void;
  onDoctorView: () => void;
}) {
  const cards: CardDef[] = [
    { id: "overview",  icon: <IconChart />,    title: "Overview",   desc: "Org stats, marketplace visibility and trial status", theme: "navy" },
    { id: "branches",  icon: <IconBuilding />, title: "Branches",   desc: "Manage clinic locations and contact details",          theme: "gold",    badge: branchCount  > 0 ? String(branchCount)  : undefined },
    { id: "staff",        icon: <IconStaff />,       title: "Staff",         desc: "Invite, edit roles, and manage team members",         theme: "navy",    badge: staffCount   > 0 ? String(staffCount)   : undefined },
    { id: "joinrequests", icon: <IconJoinRequest />, title: "Join Requests",  desc: "Review and approve doctors requesting to join",        theme: "gold" },
    { id: "schedules", icon: <IconCalendar />, title: "Schedules",  desc: "Set weekly doctor schedules, auto-generate sessions", theme: "gold",    badge: scheduleCount > 0 ? String(scheduleCount) : undefined },
    { id: "sessions",  icon: <IconClock />,    title: "Sessions",   desc: "View and cap daily patient sessions per branch",      theme: "success" },
    { id: "settings",  icon: <IconSettings />, title: "Settings",   desc: "Edit organization name and branch commission rates",  theme: "navy" },
    { id: "billing",   icon: <IconBilling />,  title: "Billing",    desc: "Subscription plans and feature access tiers",         theme: "navy" },
    { id: "whatsapp",  icon: <IconChat />,     title: "WhatsApp",   desc: "Automate appointment reminders via WhatsApp",         theme: "success" },
  ];

  const themeMap: Record<CardTheme, { ring: string; iconBg: string; badgeCls: string; arrow: string }> = {
    navy:    { ring: "hover:ring-navy/20",    iconBg: "bg-navy",    badgeCls: "bg-navy/10 text-navy",       arrow: "text-navy"    },
    gold:    { ring: "hover:ring-gold/25",    iconBg: "bg-gold",    badgeCls: "bg-gold/15 text-gold",       arrow: "text-gold"    },
    success: { ring: "hover:ring-success/20", iconBg: "bg-success", badgeCls: "bg-success/10 text-success", arrow: "text-success" },
  };

  return (
    <div className="grid animate-fade-up grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => {
        const t = themeMap[card.theme];
        return (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            style={{ animationDelay: `${i * 40}ms` }}
            className={`group flex flex-col gap-4 rounded-xl border border-border bg-white p-5 text-left shadow-sm ring-2 ring-transparent transition hover:shadow-md ${t.ring}`}
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${t.iconBg}`}>
                {card.icon}
              </div>
              {card.badge && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${t.badgeCls}`}>
                  {card.badge}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-heading text-base font-bold text-navy">{card.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-navy-mid">{card.desc}</p>
            </div>
            <span className={`text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100 ${t.arrow}`}>
              Manage →
            </span>
          </button>
        );
      })}

      {/* Doctor Queue card — dual-role users only */}
      {isAlsoDoctor && (
        <button
          onClick={onDoctorView}
          className="group flex flex-col gap-4 rounded-xl border border-gold/30 bg-gold-tint p-5 text-left shadow-sm ring-2 ring-transparent transition hover:shadow-md hover:ring-gold/25"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-white">
              <IconQueue />
            </div>
            <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-bold text-gold">Doctor</span>
          </div>
          <div className="flex-1">
            <p className="font-heading text-base font-bold text-navy">My Queue</p>
            <p className="mt-0.5 text-xs leading-relaxed text-navy-mid">
              View and manage your patient queue as a doctor
            </p>
          </div>
          <span className="text-xs font-semibold text-gold opacity-0 transition-opacity group-hover:opacity-100">
            Open Doctor View →
          </span>
        </button>
      )}
    </div>
  );
}

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="10" width="3" height="8" rx="1" fill="currentColor" opacity=".5" />
      <rect x="7.5" y="6" width="3" height="12" rx="1" fill="currentColor" opacity=".75" />
      <rect x="13" y="2" width="3" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="5" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 18v-5h6v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 9h2M11 9h2M7 12h2M11 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 5V3.5A1.5 1.5 0 0 1 12 3.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconStaff() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 17c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
      <path d="M17 17c0-2-1.3-3.2-3-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4.5" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6" y="12" width="2" height="2" rx=".5" fill="currentColor" />
      <rect x="9" y="12" width="2" height="2" rx=".5" fill="currentColor" />
      <rect x="12" y="12" width="2" height="2" rx=".5" fill="currentColor" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBilling() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="5" width="15" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 9h15" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="12" width="4" height="1.5" rx=".75" fill="currentColor" />
      <rect x="11" y="12" width="4" height="1.5" rx=".75" fill="currentColor" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5A7.5 7.5 0 0 0 3.1 13.6L2.5 17.5l3.9-.6A7.5 7.5 0 1 0 10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 7.5h13" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11.5" cy="10" r="1" fill="currentColor" />
      <path d="M4.5 4.5V3A1.5 1.5 0 0 1 6 1.5h4A1.5 1.5 0 0 1 11.5 3v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconQueue() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 14c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 6h4M11 9.5h3M11 13h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconJoinRequest() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 17c0-2.5 2-4 5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 12v6M11 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
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
  const { memberships, branches, isLoading, inviteStaff, removeMember, updateMember, grantAdmin, revokeAdmin } = useOrg();
  const [showModal, setShowModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  async function handleRemove(memberId: string, memberName: string) {
    if (!window.confirm(`Remove ${memberName || "this staff member"}? This cannot be undone.`)) return;
    setRemoving(memberId);
    await removeMember(memberId);
    setRemoving(null);
  }

  async function handleGrantAdmin(memberId: string) {
    setPromoting(memberId);
    const ok = await grantAdmin(memberId);
    if (!ok) setEditError("Failed to grant admin role. Please try again.");
    setPromoting(null);
  }

  async function handleRevokeAdmin(memberId: string) {
    if (!window.confirm("Remove admin role? The user will keep their other role(s).")) return;
    setPromoting(memberId);
    const ok = await revokeAdmin(memberId);
    if (!ok) setEditError("Failed to revoke admin role. Please try again.");
    setPromoting(null);
  }

  if (isLoading) return <Skeleton />;

  // Group memberships by userId so multi-role members appear as one card
  const grouped = new Map<string, Membership[]>();
  for (const m of memberships) {
    const key = m.userId || m.id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  const roleColors: Record<string, string> = {
    admin:        "bg-navy/10 text-navy",
    doctor:       "bg-gold-tint text-gold",
    receptionist: "bg-success/10 text-success",
  };

  const uniqueMembers = Array.from(grouped.values());
  const activeMemberCount = uniqueMembers.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-mid">{activeMemberCount} member{activeMemberCount !== 1 ? "s" : ""}</p>
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

      {editError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {editError}
        </div>
      )}

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {uniqueMembers.map((group) => {
          // Primary membership = highest-priority role
          const primary = group.find((m) => m.userRole === "admin")
            ?? group.find((m) => m.userRole === "doctor")
            ?? group[0];
          const roles = group.map((m) => m.userRole);
          const isAdmin = roles.includes("admin");
          const isDoctor = roles.includes("doctor");
          const branch = branches.find((b) => b.id === primary.branchId);
          const isBusy = promoting === primary.id || removing === primary.id;

          return (
            <div key={primary.id} className="flex items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-medium text-navy">{primary.memberName || "–"}</p>
                  {roles.map((r) => (
                    <span key={r} className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[r] ?? "bg-border text-navy-mid"}`}>
                      {r}
                    </span>
                  ))}
                </div>
                <p className="mt-0.5 truncate text-xs text-navy-mid">{primary.invitedEmail}</p>
                {branch && <p className="text-xs text-navy-mid">{branch.name}</p>}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  primary.status === "active" ? "bg-success/10 text-success" : "bg-gold-tint text-gold"
                }`}>
                  {primary.status}
                </span>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingMember(primary); setEditError(null); }}
                    className="text-xs font-medium text-gold hover:text-gold-light"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(primary.id, primary.memberName)}
                    disabled={isBusy}
                    className="text-xs font-medium text-danger hover:text-danger/70 disabled:opacity-40"
                  >
                    {removing === primary.id ? "…" : "Remove"}
                  </button>
                </div>
                {/* Make Admin / Revoke Admin — only for non-admin doctors/receptionists */}
                {!isAdmin && isDoctor && (
                  <button
                    onClick={() => handleGrantAdmin(primary.id)}
                    disabled={isBusy}
                    className="rounded-md border border-navy/20 px-3 py-1 text-xs font-medium text-navy transition hover:bg-navy hover:text-white disabled:opacity-40"
                  >
                    {promoting === primary.id ? "…" : "Make Admin"}
                  </button>
                )}
                {isAdmin && isDoctor && (
                  <button
                    onClick={() => handleRevokeAdmin(
                      group.find((m) => m.userRole === "admin")?.id ?? primary.id,
                    )}
                    disabled={isBusy}
                    className="rounded-md border border-danger/20 px-3 py-1 text-xs font-medium text-danger transition hover:bg-danger/5 disabled:opacity-40"
                  >
                    {promoting === primary.id ? "…" : "Revoke Admin"}
                  </button>
                )}
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

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={async (data) => {
            const ok = await updateMember(editingMember.id, data);
            if (ok) {
              setEditingMember(null);
              setEditError(null);
            } else {
              setEditingMember(null);
              setEditError("Failed to update member. Please try again.");
            }
          }}
        />
      )}
    </div>
  );
}

// ── Join Requests Tab ─────────────────────────────────────────────────────────

function JoinRequestsTab() {
  const { org } = useOrg();
  const [requests, setRequests] = useState<AdminJoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org?.id) return;
    setIsLoading(true);
    jr.getOrgJoinRequests(org.id, statusFilter)
      .then(setRequests)
      .catch(() => setError("Failed to load join requests."))
      .finally(() => setIsLoading(false));
  }, [org?.id, statusFilter]);

  async function handleResolve(requestId: string, action: "approve" | "reject") {
    if (!org?.id) return;
    setResolving(requestId);
    try {
      await jr.resolveJoinRequest(org.id, requestId, action);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      setError(`Failed to ${action} request.`);
    } finally {
      setResolving(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-navy">Join Requests</h2>
          <p className="text-sm text-navy-mid">Doctors requesting to join your organization</p>
        </div>
        <div className="flex gap-1.5 rounded-lg border border-border p-1">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                statusFilter === s ? "bg-navy text-white" : "text-navy-mid hover:text-navy"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-offwhite" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-offwhite px-6 py-12 text-center">
          <p className="text-sm font-medium text-navy">No {statusFilter} requests</p>
          <p className="mt-1 text-xs text-navy-mid">
            {statusFilter === "pending"
              ? "New join requests will appear here"
              : `Previously ${statusFilter} requests will appear here`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-sm font-bold text-navy">{req.accountName}</p>
                    {req.specialties.length > 0 && (
                      <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">
                        {req.specialties[0]}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-navy-mid">{req.accountEmail} · {req.accountPhone}</p>
                  {req.licenseNumber && (
                    <p className="mt-0.5 text-xs text-navy-mid">License: {req.licenseNumber}</p>
                  )}
                  {req.message && (
                    <p className="mt-2 rounded-md bg-offwhite px-3 py-2 text-xs italic text-navy-mid">
                      "{req.message}"
                    </p>
                  )}
                  <p className="mt-2 text-xs text-navy-mid/60">
                    {new Date(req.createdAt).toLocaleDateString("en-EG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {statusFilter === "pending" && (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => handleResolve(req.id, "approve")}
                      disabled={resolving === req.id}
                      className="rounded-lg bg-success px-4 py-2 text-xs font-semibold text-white transition hover:bg-success/90 disabled:opacity-60"
                    >
                      {resolving === req.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleResolve(req.id, "reject")}
                      disabled={resolving === req.id}
                      className="rounded-lg border border-danger/30 px-4 py-2 text-xs font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {statusFilter !== "pending" && (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                    req.status === "approved" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                  }`}>
                    {req.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Schedules Tab ─────────────────────────────────────────────────────────────

// Doctor colour palette for calendar slots
const DOCTOR_COLORS = [
  { bg: "bg-navy/10",     text: "text-navy",    border: "border-navy/20",    dot: "bg-navy"    },
  { bg: "bg-gold/15",     text: "text-gold",    border: "border-gold/30",    dot: "bg-gold"    },
  { bg: "bg-success/10",  text: "text-success", border: "border-success/25", dot: "bg-success" },
  { bg: "bg-purple-50",   text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  { bg: "bg-orange-50",   text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
];

function SchedulesTab() {
  const { schedules, memberships, branches, isLoading, createSchedule, updateSchedule, addException } = useOrg();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DoctorBranchSchedule | null>(null);
  const [exceptionScheduleId, setExceptionScheduleId] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  if (isLoading) return <Skeleton />;

  const doctors = memberships.filter((m) => m.userRole === "doctor");
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Build a map: dayOfWeek → slots with schedule info
  const slotsByDay = Array.from({ length: 7 }, (_, d) => {
    const daySlots: Array<{ schedule: DoctorBranchSchedule; slot: DoctorBranchSchedule["weeklySlots"][0]; colorIdx: number }> = [];
    schedules.forEach((s, si) => {
      s.weeklySlots.forEach((slot) => {
        if (slot.dayOfWeek === d) daySlots.push({ schedule: s, slot, colorIdx: si % DOCTOR_COLORS.length });
      });
    });
    return daySlots.sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
  });

  const slotsForSelected = selectedDay !== null ? slotsByDay[selectedDay] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-navy">Weekly Schedule</h2>
          <p className="text-sm text-navy-mid">{schedules.length} schedule{schedules.length !== 1 ? "s" : ""} across {doctors.length} doctor{doctors.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          + Add Schedule
        </button>
      </div>

      {lastGenerated !== null && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Schedule saved — {lastGenerated} session{lastGenerated !== 1 ? "s" : ""} auto-generated for the next 14 days.
        </div>
      )}

      {/* Legend */}
      {schedules.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {schedules.map((s, i) => {
            const c = DOCTOR_COLORS[i % DOCTOR_COLORS.length];
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                <span className="text-xs text-navy-mid">{s.doctorName}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar week grid */}
      {schedules.length === 0 ? (
        <EmptyState icon="📅" title="No schedules yet" body="Add a doctor's weekly schedule to auto-generate sessions." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map((day, d) => {
              const count = slotsByDay[d].length;
              const isSelected = selectedDay === d;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : d)}
                  className={`flex flex-col items-center py-3 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-navy text-white"
                      : count > 0
                        ? "text-navy hover:bg-offwhite"
                        : "text-navy-mid/40 hover:bg-offwhite/50"
                  }`}
                >
                  <span>{day}</span>
                  {count > 0 && (
                    <span className={`mt-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-gold/20 text-gold"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Slot rows per day */}
          <div className="grid grid-cols-7 divide-x divide-border">
            {slotsByDay.map((daySlots, d) => (
              <div
                key={d}
                onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                className={`min-h-[120px] cursor-pointer p-2 transition hover:bg-offwhite/60 ${
                  selectedDay === d ? "bg-navy/5" : ""
                }`}
              >
                {daySlots.map(({ schedule, slot, colorIdx }, i) => {
                  const c = DOCTOR_COLORS[colorIdx];
                  return (
                    <div
                      key={`${schedule.id}-${i}`}
                      className={`mb-1.5 rounded-md border px-1.5 py-1 ${c.bg} ${c.border}`}
                    >
                      <p className={`truncate text-[10px] font-semibold leading-tight ${c.text}`}>
                        {schedule.doctorName.split(" ")[0]}
                      </p>
                      <p className={`text-[9px] leading-tight ${c.text} opacity-80`}>
                        {slot.startTime}–{slot.endTime}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel for selected day */}
      {selectedDay !== null && (
        <div className="animate-fade-up rounded-xl border border-border bg-white p-5">
          <h3 className="mb-3 font-heading text-base font-bold text-navy">{DAYS_FULL[selectedDay]}</h3>
          {slotsForSelected.length === 0 ? (
            <p className="text-sm text-navy-mid">No sessions scheduled on this day.</p>
          ) : (
            <div className="space-y-3">
              {slotsForSelected.map(({ schedule, slot, colorIdx }) => {
                const branch = branches.find((b) => b.id === schedule.branchId);
                const c = DOCTOR_COLORS[colorIdx];
                return (
                  <div key={`${schedule.id}-${slot.startTime}`} className={`flex items-start justify-between rounded-xl border p-4 ${c.bg} ${c.border}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                        <p className={`font-heading text-sm font-bold ${c.text}`}>{schedule.doctorName}</p>
                        <span className={`text-xs opacity-70 ${c.text}`}>{schedule.specialty}</span>
                      </div>
                      <p className={`mt-1 text-xs ${c.text} opacity-80`}>
                        {slot.startTime} – {slot.endTime} · {branch?.name ?? "Branch"}
                      </p>
                      <p className={`text-xs ${c.text} opacity-70`}>
                        {schedule.fee} EGP · {schedule.avgConsultationMin} min avg
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingSchedule(schedule); }}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 ${c.border} ${c.text}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setExceptionScheduleId(schedule.id); }}
                        className="rounded-md border border-danger/20 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/5"
                      >
                        Off Day
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

// ── Wallet Tab ────────────────────────────────────────────────────────────────

function WalletTab() {
  const { org, branches } = useOrg();
  const orgId = org?.id ?? "";

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  function refreshSummary() {
    if (!orgId) return;
    setLoadingSummary(true);
    orgService.getWalletSummary(orgId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }

  useEffect(() => {
    refreshSummary();
    // Auto-refresh summary every 30s so wallet updates after sessions complete
    const id = setInterval(refreshSummary, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, refreshKey]);

  useEffect(() => {
    if (!orgId) return;
    setLoadingTx(true);
    orgService.getTransactions(orgId, {
      branchId: filterBranch || undefined,
      status: filterStatus || undefined,
      from: filterFrom || undefined,
      to: filterTo || undefined,
      page,
      limit: 20,
    }).then(({ transactions: txs, total: t }) => {
      setTransactions(txs);
      setTotal(t);
    }).catch(() => {
      setTransactions([]);
      setTotal(0);
    }).finally(() => setLoadingTx(false));
  }, [orgId, filterBranch, filterStatus, filterFrom, filterTo, page]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  const statusBadge = (s: string) => {
    if (s === "settled")  return "bg-success/10 text-success";
    if (s === "pending")  return "bg-gold/15 text-gold";
    if (s === "refunded") return "bg-danger/10 text-danger";
    return "bg-border text-navy-mid";
  };

  return (
    <div className="space-y-5">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-navy">Wallet</h2>
          <p className="text-sm text-navy-mid">Revenue from completed sessions</p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-navy-mid transition hover:border-navy hover:text-navy"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-offwhite p-4 text-center">
          <p className="text-xs text-navy-mid">Total Earnings</p>
          <p className="mt-1 font-heading text-2xl font-bold text-navy">
            {loadingSummary ? "…" : `${(summary?.totalEarnings ?? 0).toLocaleString()} EGP`}
          </p>
        </div>
        <div className="rounded-xl border border-gold/30 bg-gold-tint p-4 text-center">
          <p className="text-xs text-navy-mid">This Month</p>
          <p className="mt-1 font-heading text-2xl font-bold text-gold">
            {loadingSummary ? "…" : `${(summary?.thisMonthEarnings ?? 0).toLocaleString()} EGP`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-offwhite p-4 text-center">
          <p className="text-xs text-navy-mid">Pending</p>
          <p className="mt-1 font-heading text-2xl font-bold text-navy-mid">
            {loadingSummary ? "…" : `${(summary?.pendingAmount ?? 0).toLocaleString()} EGP`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterBranch}
          onChange={(e) => { setFilterBranch(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold"
        >
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold"
        >
          <option value="">All Status</option>
          <option value="settled">Settled</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
        </select>
        <input
          type="date" value={filterFrom}
          onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold"
        />
        <input
          type="date" value={filterTo}
          onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold"
        />
        {(filterBranch || filterStatus || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterBranch(""); setFilterStatus(""); setFilterFrom(""); setFilterTo(""); setPage(1); }}
            className="h-9 rounded-md border border-border px-3 text-sm text-navy-mid hover:text-danger"
          >
            Clear
          </button>
        )}
      </div>

      {/* Transaction list */}
      {loadingTx ? (
        <Skeleton />
      ) : transactions.length === 0 ? (
        <EmptyState icon="💳" title="No transactions yet" body="Completed appointments will appear here as settled transactions." />
      ) : (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-5 bg-offwhite px-4 py-2 text-xs font-semibold uppercase tracking-wide text-navy-mid">
              <span className="col-span-2">Patient / Branch</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Commission</span>
              <span className="text-right">Status</span>
            </div>
            {transactions.map((tx) => (
              <div key={tx.id} className="grid grid-cols-5 items-center gap-2 px-4 py-3">
                <div className="col-span-2">
                  <p className="text-sm font-medium text-navy">{tx.patientName || "—"}</p>
                  <p className="text-xs text-navy-mid">{tx.branchName} · {tx.createdAt.slice(0, 10)}</p>
                </div>
                <p className="text-right text-sm font-medium text-navy">{tx.grossAmount} {tx.currency}</p>
                <p className="text-right text-sm font-semibold text-gold">+{tx.commissionAmount} {tx.currency}</p>
                <div className="flex justify-end">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy-mid">{total} total transactions</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-border px-3 py-1.5 text-navy-mid disabled:opacity-40 hover:border-gold hover:text-gold"
                >
                  ← Prev
                </button>
                <span className="flex items-center px-2 text-navy-mid">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-border px-3 py-1.5 text-navy-mid disabled:opacity-40 hover:border-gold hover:text-gold"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const { org, branches, updateOrg, refresh } = useOrg();
  const orgId = org?.id ?? "";

  const [orgName, setOrgName] = useState(org?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameResult, setNameResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [commissionEdits, setCommissionEdits] = useState<Record<string, string>>({});
  const [savingBranch, setSavingBranch] = useState<string | null>(null);
  const [branchResult, setBranchResult] = useState<{ id: string; ok: boolean } | null>(null);

  async function handleSaveName(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!orgName.trim() || orgName.trim() === org?.name) return;
    setSavingName(true);
    setNameResult(null);
    const result = await updateOrg({ name: orgName.trim() });
    setNameResult({ ok: result.ok, msg: result.ok ? "Saved!" : (result.error ?? "Failed") });
    setSavingName(false);
  }

  async function handleSaveCommission(branch: Branch) {
    const raw = commissionEdits[branch.id];
    if (raw === undefined) return;
    const val = Number(raw);
    if (isNaN(val) || val < 0 || val > 100) return;
    setSavingBranch(branch.id);
    setBranchResult(null);
    try {
      await orgService.updateBranch(orgId, branch.id, { commissionPct: val });
      await refresh();
      setBranchResult({ id: branch.id, ok: true });
      setCommissionEdits((prev) => { const n = { ...prev }; delete n[branch.id]; return n; });
    } catch {
      setBranchResult({ id: branch.id, ok: false });
    } finally {
      setSavingBranch(null);
    }
  }

  return (
    <div className="space-y-7">
      {/* Org name */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-mid">Organization Name</p>
        <form onSubmit={handleSaveName} className="flex gap-2">
          <input
            value={orgName}
            onChange={(e) => { setOrgName(e.target.value); setNameResult(null); }}
            className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            placeholder="Organization name"
          />
          <button
            type="submit"
            disabled={savingName || !orgName.trim() || orgName.trim() === org?.name}
            className="h-10 rounded-lg bg-gold px-4 text-sm font-semibold text-navy disabled:opacity-50 hover:bg-gold-light"
          >
            {savingName ? "Saving…" : "Save"}
          </button>
        </form>
        {nameResult && (
          <p className={`mt-1.5 text-xs ${nameResult.ok ? "text-success" : "text-danger"}`}>{nameResult.msg}</p>
        )}
      </div>

      {/* Branch commission */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-mid">Branch Commission Rate</p>
        <p className="mb-3 text-xs text-navy-mid">
          Percentage of post-platform revenue the organization keeps. Doctors receive the remainder.
        </p>
        {branches.length === 0 ? (
          <EmptyState icon="🏢" title="No branches" body="Add branches first to configure commission rates." />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {branches.map((branch) => {
              const editing = commissionEdits[branch.id] !== undefined;
              const val = editing ? commissionEdits[branch.id] : String(branch.commissionPct !== undefined ? branch.commissionPct : 70);
              const isSaving = savingBranch === branch.id;
              const result = branchResult?.id === branch.id ? branchResult : null;
              return (
                <div key={branch.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <div>
                    <p className="font-medium text-navy">{branch.name}</p>
                    <p className="text-xs text-navy-mid">{branch.city || branch.address || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={val}
                        onChange={(e) => setCommissionEdits((prev) => ({ ...prev, [branch.id]: e.target.value }))}
                        className="h-9 w-20 rounded-md border border-border bg-white px-2 text-center text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                      />
                      <span className="text-sm text-navy-mid">%</span>
                    </div>
                    <button
                      disabled={isSaving || !editing}
                      onClick={() => handleSaveCommission(branch)}
                      className="h-9 rounded-md bg-gold px-3 text-sm font-semibold text-navy disabled:opacity-50 hover:bg-gold-light"
                    >
                      {isSaving ? "…" : "Save"}
                    </button>
                    {result && (
                      <span className={`text-xs ${result.ok ? "text-success" : "text-danger"}`}>
                        {result.ok ? "Saved!" : "Failed"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

function EditMemberModal({
  member,
  onClose,
  onSave,
}: {
  member: Membership;
  onClose: () => void;
  onSave: (data: { kind?: Membership["userRole"]; specialties?: string[]; bio?: string; permissions?: string[] }) => Promise<void>;
}) {
  const [role, setRole] = useState<Membership["userRole"]>(member.userRole);
  const [specialties, setSpecialties] = useState(member.specialties?.join(", ") ?? "");
  const [bio, setBio] = useState(member.bio ?? "");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function togglePermission(perm: string) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data: { kind?: Membership["userRole"]; specialties?: string[]; bio?: string; permissions?: string[] } = {};
    if (role !== member.userRole) data.kind = role;
    if (role === "doctor" && specialties.trim()) {
      data.specialties = specialties.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (bio.trim()) data.bio = bio.trim();
    if (role === "admin" && permissions.length > 0) data.permissions = permissions;
    await onSave(data);
    setSaving(false);
  }

  return (
    <ModalShell title="Edit Staff Member" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-md bg-offwhite px-4 py-3">
          <p className="font-medium text-navy">{member.memberName || "—"}</p>
          <p className="text-xs text-navy-mid">{member.invitedEmail}</p>
        </div>

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
          {role !== member.userRole && (
            <p className="mt-1.5 text-xs text-gold">Role change will take effect immediately.</p>
          )}
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

        <ModalField label="Bio" value={bio} onChange={setBio} placeholder="Brief bio or notes..." />

        <ModalActions onClose={onClose} saving={saving} label="Save Changes" />
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
            const maxVal = isEditing ? editingMax[session.id] : session.maxBookings != null ? String(session.maxBookings) : "";
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
