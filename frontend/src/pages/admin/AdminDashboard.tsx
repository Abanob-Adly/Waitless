import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";
import { useLanguage } from "../../context/LanguageContext";
import { fmt12 } from "../../utils/time";
import { validatePhone } from "../../utils/validation";
import { toE164 } from "../../utils/phone";
import type { Branch, Membership, DoctorBranchSchedule } from "../../types/index";
import * as sessionService from "../../services/sessionService";
import type { BackendSession } from "../../services/sessionService";
import * as orgService from "../../services/orgService";
import * as paymentService from "../../services/paymentService";
import type { WalletSummary, WalletTransaction, Invoice } from "../../services/orgService";
import * as jr from "../../services/joinRequestService";
import type { AdminJoinRequest } from "../../services/joinRequestService";
import { WalletView } from "../../components/ui/WalletView";

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminSection = "overview" | "branches" | "staff" | "joinrequests" | "schedules" | "sessions" | "wallet" | "billing" | "whatsapp" | "settings";

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { authUser, logout } = useAuth();
  const navigate = useNavigate();
  const { org, isLoading, myRoles, branches, memberships, schedules } = useOrg();
  const { t, locale } = useLanguage();
  const [searchParams] = useSearchParams();
  const VALID_SECTIONS: AdminSection[] = ["overview","branches","staff","joinrequests","schedules","sessions","wallet","billing","whatsapp","settings"];
  const [activeSection, setActiveSection] = useState<AdminSection | null>(() => {
    const tab = searchParams.get("tab") as AdminSection | null;
    return tab && VALID_SECTIONS.includes(tab) ? tab : null;
  });

  // React to URL tab param changes (handles same-page navigation e.g. from UpgradeModal)
  useEffect(() => {
    const tab = searchParams.get("tab") as AdminSection | null;
    if (tab && VALID_SECTIONS.includes(tab)) {
      setActiveSection(tab);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authUser || authUser.role !== "admin") {
    navigate("/login", { replace: true });
    return null;
  }

  const admin = authUser.profile as { id: string; name: string; orgId: string };
  const initials = admin.name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  const isAlsoDoctor = myRoles.includes("doctor");
  const staffCount  = new Set(memberships.filter((m) => m.status === "active").map((m) => m.userId || m.id)).size;

  const sectionTitle: Record<AdminSection, string> = {
    overview: t("Overview"), branches: t("Branches"), staff: t("Staff"),
    joinrequests: t("Join Requests"),
    schedules: t("Schedules"), sessions: t("Sessions"), wallet: t("My Wallet"),
    billing: t("Billing"), whatsapp: "WhatsApp", settings: t("Settings"),
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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10" dir={locale === "ar" ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="mb-8 flex animate-fade-up flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold font-heading text-base font-bold text-navy">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">{t("Admin")}</span>
              {isAlsoDoctor && (
                <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">{t("Doctor")}</span>
              )}
            </div>
            <h1 className="mt-0.5 truncate font-heading text-2xl font-bold text-navy sm:text-3xl">
              {isLoading ? t("Loading…") : org?.name ?? t("Your Organization")}
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
            <span className="hidden sm:inline">{t("My Wallet")}</span>
          </button>

          {isAlsoDoctor && (
            <button
              onClick={() => navigate("/doctor-dashboard")}
              className="hidden items-center gap-1.5 rounded-lg border border-navy/20 bg-navy/5 px-3 py-2 text-sm font-medium text-navy transition hover:bg-navy/10 sm:flex"
            >
              <IconQueue />
              <span>{t("My Queue")}</span>
            </button>
          )}

          <button
            onClick={() => { logout(); navigate("/"); }}
            className="rounded-lg border border-border px-3 py-2 text-sm text-navy-mid transition hover:border-danger/40 hover:text-danger"
          >
            <span className="hidden sm:inline">{t("Sign Out")}</span>
            <span className="inline sm:hidden">✕</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      {activeSection && (
        <div className="mb-5 flex items-center gap-2 text-sm">
          <button onClick={() => setActiveSection(null)} className="text-navy-mid transition hover:text-navy">
            {t("← Dashboard")}
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
  const { t } = useLanguage();
  const cards: CardDef[] = [
    { id: "overview",  icon: <IconChart />,    title: t("Overview"),      desc: t("Org stats, marketplace visibility and trial status"), theme: "navy" },
    { id: "branches",  icon: <IconBuilding />, title: t("Branches"),      desc: t("Manage clinic locations and contact details"),          theme: "gold",    badge: branchCount  > 0 ? String(branchCount)  : undefined },
    { id: "staff",        icon: <IconStaff />,       title: t("Staff"),         desc: t("Invite, edit roles, and manage team members"),         theme: "navy",    badge: staffCount   > 0 ? String(staffCount)   : undefined },
    { id: "joinrequests", icon: <IconJoinRequest />, title: t("Join Requests"), desc: t("Review and approve doctors requesting to join"),        theme: "gold" },
    { id: "schedules", icon: <IconCalendar />, title: t("Schedules"),     desc: t("Set weekly doctor schedules, auto-generate sessions"), theme: "gold",    badge: scheduleCount > 0 ? String(scheduleCount) : undefined },
    { id: "sessions",  icon: <IconClock />,    title: t("Sessions"),      desc: t("View and cap daily patient sessions per branch"),      theme: "success" },
    { id: "settings",  icon: <IconSettings />, title: t("Settings"),      desc: t("Edit organization name and branch commission rates"),  theme: "navy" },
    { id: "billing",   icon: <IconBilling />,  title: t("Billing"),       desc: t("Subscription plans and feature access tiers"),         theme: "navy" },
    { id: "whatsapp",  icon: <IconChat />,     title: "WhatsApp",         desc: t("Automate appointment reminders via WhatsApp"),         theme: "success" },
  ];

  const themeMap: Record<CardTheme, { ring: string; iconBg: string; badgeCls: string; arrow: string }> = {
    navy:    { ring: "hover:ring-navy/20",    iconBg: "bg-navy",    badgeCls: "bg-navy/10 text-navy",       arrow: "text-navy"    },
    gold:    { ring: "hover:ring-gold/25",    iconBg: "bg-gold",    badgeCls: "bg-gold/15 text-gold",       arrow: "text-gold"    },
    success: { ring: "hover:ring-success/20", iconBg: "bg-success", badgeCls: "bg-success/10 text-success", arrow: "text-success" },
  };

  return (
    <div className="grid animate-fade-up grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => {
        const cls = themeMap[card.theme];
        return (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            style={{ animationDelay: `${i * 40}ms` }}
            className={`group flex flex-col gap-4 rounded-xl border border-border bg-white p-5 text-left shadow-sm ring-2 ring-transparent transition hover:shadow-md ${cls.ring}`}
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${cls.iconBg}`}>
                {card.icon}
              </div>
              {card.badge && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cls.badgeCls}`}>
                  {card.badge}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-heading text-base font-bold text-navy">{card.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-navy-mid">{card.desc}</p>
            </div>
            <span className={`text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100 ${cls.arrow}`}>
              {t("Open →")}
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
            <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-bold text-gold">{t("Doctor")}</span>
          </div>
          <div className="flex-1">
            <p className="font-heading text-base font-bold text-navy">{t("My Queue")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-navy-mid">
              {t("Doctor View →")}
            </p>
          </div>
          <span className="text-xs font-semibold text-gold opacity-0 transition-opacity group-hover:opacity-100">
            {t("Doctor View →")}
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
  const { t } = useLanguage();
  const [toggling, setToggling] = useState(false);
  const [visResult, setVisResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (isLoading) return <Skeleton />;

  const plan = plans.find((p) => p.id === subscription?.planId);
  const doctorCount = memberships.filter((m) => m.userRole === "doctor" && m.status === "active").length;
  const staffCount = new Set(memberships.filter((m) => m.status === "active").map((m) => m.userId || m.id)).size;

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
          <StatBox key="br" label={t("Branches")} value={branches.length.toString()} />,
          <StatBox key="dr" label={t("Doctors")} value={doctorCount.toString()} />,
          <StatBox key="st" label={t("Total Staff")} value={staffCount.toString()} accent />,
          <StatBox key="pl" label={t("Plan")} value={plan?.name ?? "—"} success />,
        ].map((box, i) => (
          <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            {box}
          </div>
        ))}
      </div>

      {branches.length === 0 && (
        <div className="rounded-xl border border-gold bg-gold-tint px-5 py-4">
          <p className="text-sm font-semibold text-navy">{t("Add your first branch to get started")}</p>
          <p className="mt-1 text-xs text-navy-mid">
            {t("Doctors, schedules, and sessions all require a branch. Head to the Branches tab to add one.")}
          </p>
        </div>
      )}

      {subscription?.status === "trial" && branches.length > 0 && (
        <div className="rounded-xl border border-gold bg-gold-tint px-5 py-4">
          <p className="text-sm font-semibold text-navy">
            {t("Free Trial")}
          </p>
          <p className="mt-1 text-xs text-navy-mid">
            {t("Upgrade to a paid plan to unlock marketplace listing and more features.")}
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
          {t("Organization")}
        </p>
        <p className="mt-2 font-heading text-lg font-bold text-navy">{org?.name}</p>
        <p className="text-sm text-navy-mid capitalize">{org?.type}</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-navy-mid">{t("Marketplace Listing")}</p>
            <p className="mt-0.5 text-xs text-navy-mid">
              {org?.isPublic ? t("Visible to patients") : t("Not listed publicly")}
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
            {toggling ? t("Saving…") : org?.isPublic ? t("Make Private") : t("List Publicly →")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Branches Tab ──────────────────────────────────────────────────────────────

function BranchesTab() {
  const { org, branches, isLoading, addBranch, subscription, plans } = useOrg();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  if (isLoading) return <Skeleton />;

  const currentPlan = plans.find((p) => p.id === subscription?.planId);
  const branchLimit = currentPlan?.maxBranches ?? Infinity;
  const branchLimitHit = branches.length >= branchLimit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-mid">
          {branches.length} {locale === "ar" ? "فرع" : (branches.length !== 1 ? "branches" : "branch")}
          {branchLimit < Infinity && (
            <span className="ml-1.5 text-navy-mid/60">/ {branchLimit}</span>
          )}
        </p>
        <button
          onClick={() => {
            if (branchLimitHit) {
              navigate("/admin?tab=billing");
            } else {
              setShowModal(true);
              setBranchError(null);
            }
          }}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          {branchLimitHit ? t("Upgrade Plan →") : t("+ Add Branch")}
        </button>
      </div>

      {branchLimitHit && (
        <div className="flex items-center justify-between rounded-xl border border-gold/40 bg-gold-tint px-4 py-3">
          <p className="text-sm text-navy">
            {locale === "ar"
              ? `وصلت إلى الحد الأقصى للفروع (${branchLimit}). قم بترقية خطتك لإضافة المزيد.`
              : `You've reached your branch limit (${branchLimit}). Upgrade your plan to add more.`}
          </p>
          <button
            onClick={() => navigate("/admin?tab=billing")}
            className="ml-4 shrink-0 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition hover:bg-navy-mid"
          >
            {t("Upgrade Plan →")}
          </button>
        </div>
      )}
      {branchError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {branchError}
        </div>
      )}

      {branches.length === 0 ? (
        <EmptyState icon="🏢" title={t("No branches yet")} body={t("Add your first branch to get started.")} />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-navy">{b.name}</p>
                <p className="text-sm text-navy-mid">{b.address}{b.city ? `, ${b.city}` : ""}</p>
                {b.phone && <p className="text-xs text-navy-mid">{b.phone}</p>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingBranch(b)}
                  className="text-xs font-medium text-gold hover:text-gold-light transition"
                >
                  {t("Edit")}
                </button>
                <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  {t("Active")}
                </span>
              </div>
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

      {editingBranch && org && (
        <EditBranchModal
          branch={editingBranch}
          orgId={org.id}
          onClose={() => setEditingBranch(null)}
          onSaved={() => { setEditingBranch(null); }}
        />
      )}
    </div>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab() {
  const { memberships, branches, isLoading, inviteStaff, removeMember, updateMember, grantAdmin, revokeAdmin, subscription, plans } = useOrg();
  const { t, locale } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleRemove(memberId: string, nameOrEmail: string, status: string) {
    const isPending = status === "pending";
    const msg = isPending
      ? `Cancel invite to ${nameOrEmail || "this invitee"}? The invite link will be invalidated.`
      : `Remove ${nameOrEmail || "this staff member"}? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setRemoving(memberId);
    await removeMember(memberId);
    setRemoving(null);
  }

  async function handleCopyInviteLink(member: Membership) {
    const link = `${window.location.origin}/accept-invite?token=${member.inviteToken}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(member.id);
    setTimeout(() => setCopiedId(null), 2000);
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
  const activeAdminGroups = uniqueMembers.filter((g) => g.some((m) => m.userRole === "admin" && m.status === "active"));
  const isLastAdminGroup = (group: typeof uniqueMembers[0]) =>
    activeAdminGroups.length === 1 && group.some((m) => m.userRole === "admin" && m.status === "active");

  const currentPlan = plans.find((p) => p.id === subscription?.planId);
  const doctorLimit = currentPlan?.maxDoctors ?? Infinity;
  const receptionistLimit = currentPlan?.maxReceptionists ?? Infinity;
  const adminLimit = currentPlan?.maxAdmins ?? Infinity;
  const activeDocCount = memberships.filter((m) => m.userRole === "doctor" && m.status === "active").length;
  const activeReceptCount = memberships.filter((m) => m.userRole === "receptionist" && m.status === "active").length;
  const activeAdminCount = memberships.filter((m) => m.userRole === "admin" && m.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-mid">{activeMemberCount} {t("member(s)")}</p>
        <button
          onClick={() => { setShowModal(true); setGeneratedToken(null); }}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          {t("+ Invite Staff")}
        </button>
      </div>
      {currentPlan && (
        <div className="flex flex-wrap gap-4 text-xs text-navy-mid">
          <span>{t("Doctors")}: {activeDocCount} / {isFinite(doctorLimit) ? doctorLimit : "∞"}</span>
          <span>{t("Admins")}: {activeAdminCount} / {isFinite(adminLimit) ? adminLimit : "∞"}</span>
          <span>{t("Receptionists")}: {activeReceptCount} / {isFinite(receptionistLimit) ? receptionistLimit : "∞"}</span>
        </div>
      )}

      {generatedToken && (
        <div className="rounded-xl border border-gold bg-gold-tint p-4">
          <p className="text-xs font-semibold text-navy">{t("Invitation link (share with invitee):")}</p>
          <p className="mt-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-navy-mid">
            {window.location.origin}/accept-invite?token={generatedToken}
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${generatedToken}`)}
            className="mt-2 text-xs font-medium text-gold hover:text-gold-light"
          >
            {t("Copy link →")}
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
          const isLastAdmin = isLastAdminGroup(group);
          const lastAdminTip = t("You cannot edit or remove the last admin. Assign another admin first.");

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
                <div className="flex flex-wrap justify-end gap-2">
                  {primary.status === "pending" && primary.inviteToken ? (
                    <button
                      onClick={() => handleCopyInviteLink(primary)}
                      className="text-xs font-medium text-gold hover:text-gold-light"
                    >
                      {copiedId === primary.id ? t("Invite link copied!") : t("Copy Invite Link")}
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (!isLastAdmin) { setEditingMember(primary); setEditError(null); } }}
                      disabled={isLastAdmin}
                      title={isLastAdmin ? lastAdminTip : undefined}
                      className="text-xs font-medium text-gold hover:text-gold-light disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t("Edit")}
                    </button>
                  )}
                  <button
                    onClick={() => { if (!isLastAdmin) handleRemove(primary.id, primary.invitedEmail || primary.memberName, primary.status); }}
                    disabled={isBusy || isLastAdmin}
                    title={isLastAdmin ? lastAdminTip : undefined}
                    className="text-xs font-medium text-danger hover:text-danger/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {removing === primary.id ? "…" : (primary.status === "pending" ? t("Cancel Invite") : t("Remove"))}
                  </button>
                </div>
                {/* Make Admin — doctors only; receptionists cannot be promoted to admin */}
                {!isAdmin && isDoctor && (
                  <button
                    onClick={() => handleGrantAdmin(primary.id)}
                    disabled={isBusy}
                    className="rounded-md border border-navy/20 px-3 py-1 text-xs font-medium text-navy transition hover:bg-navy hover:text-white disabled:opacity-40"
                  >
                    {promoting === primary.id ? "…" : t("Make Admin")}
                  </button>
                )}
                {!isAdmin && !isDoctor && roles.includes("receptionist") && (
                  <span
                    title={t("Receptionists cannot be promoted to admin")}
                    className="cursor-not-allowed rounded-md border border-border px-3 py-1 text-xs font-medium text-navy-mid/40"
                  >
                    {t("Make Admin")}
                  </span>
                )}
                {/* Revoke Admin — for any member who holds an admin role */}
                {isAdmin && (
                  <button
                    onClick={() => { if (!isLastAdmin) handleRevokeAdmin(group.find((m) => m.userRole === "admin")?.id ?? primary.id); }}
                    disabled={isBusy || isLastAdmin}
                    title={isLastAdmin ? lastAdminTip : undefined}
                    className="rounded-md border border-danger/20 px-3 py-1 text-xs font-medium text-danger transition hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {promoting === primary.id ? "…" : t("Revoke Admin")}
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
          doctorLimit={doctorLimit}
          receptionistLimit={receptionistLimit}
          activeDocCount={activeDocCount}
          activeReceptCount={activeReceptCount}
          onClose={() => setShowModal(false)}
          onSave={async (branchId, email, role, specialties) => {
            const token = await inviteStaff(branchId, email, role, specialties, undefined);
            if (token) setGeneratedToken(token);
            setShowModal(false);
          }}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          branches={branches}
          onClose={() => setEditingMember(null)}
          onSave={async (data) => {
            const result = await updateMember(editingMember.id, data);
            if (result === true) {
              setEditingMember(null);
              setEditError(null);
            } else {
              setEditingMember(null);
              setEditError(
                typeof result === "string"
                  ? result
                  : "Failed to update member. Please try again.",
              );
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
  const { t, locale } = useLanguage();
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
          <h2 className="font-heading text-lg font-bold text-navy">{t("Join Requests")}</h2>
          <p className="text-sm text-navy-mid">{t("Doctors requesting to join your organization")}</p>
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
          <p className="text-sm font-medium text-navy">{t("No")} {t(statusFilter)} {t("requests")}</p>
          <p className="mt-1 text-xs text-navy-mid">
            {statusFilter === "pending"
              ? t("New join requests will appear here")
              : locale === "ar"
                ? `${t("Previously")} ${t(statusFilter)} ${t("requests will appear here")}`
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
                      {resolving === req.id ? "…" : t("Approve")}
                    </button>
                    <button
                      onClick={() => handleResolve(req.id, "reject")}
                      disabled={resolving === req.id}
                      className="rounded-lg border border-danger/30 px-4 py-2 text-xs font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-60"
                    >
                      {t("Reject")}
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
  const { t, locale } = useLanguage();
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
          <h2 className="font-heading text-lg font-bold text-navy">{t("Weekly Schedule")}</h2>
          <p className="text-sm text-navy-mid">{schedules.length} {locale === "ar" ? "جدول لـ" : `schedule${schedules.length !== 1 ? "s" : ""} across`} {doctors.length} {locale === "ar" ? "طبيب" : `doctor${doctors.length !== 1 ? "s" : ""}`}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-gold-light"
        >
          {t("+ Add Schedule")}
        </button>
      </div>

      {lastGenerated !== null && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {locale === "ar"
            ? `تم حفظ الجدول — تم إنشاء ${lastGenerated} جلسة للـ 14 يوماً القادمة. سيعكس الملف الشخصي للطبيب ذلك خلال 30 ثانية.`
            : `Schedule saved — ${lastGenerated} session${lastGenerated !== 1 ? "s" : ""} generated for the next 14 days. Doctor Profile will reflect this within 30 seconds.`}
        </div>
      )}

      {/* Doctor list — direct Edit access, no need to open a specific day first */}
      {schedules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {schedules.map((s, i) => {
            const c = DOCTOR_COLORS[i % DOCTOR_COLORS.length];
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 ${c.border} ${c.bg}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                <span className="text-xs text-navy-mid">{s.doctorName}</span>
                <button
                  onClick={() => setEditingSchedule(s)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition hover:opacity-80 ${c.border} ${c.text}`}
                >
                  {t("Edit")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar week grid */}
      {schedules.length === 0 ? (
        <EmptyState icon="📅" title={t("No schedules yet")} body={t("Add a doctor's weekly schedule to auto-generate sessions.")} />
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
                        {fmt12(slot.startTime, locale)}–{fmt12(slot.endTime, locale)}
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
            <p className="text-sm text-navy-mid">{t("No sessions scheduled on this day.")}</p>
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
                        {fmt12(slot.startTime, locale)} – {fmt12(slot.endTime, locale)} · {branch?.name ?? "Branch"}
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
                        {t("Edit")}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setExceptionScheduleId(schedule.id); }}
                        className="rounded-md border border-danger/20 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/5"
                      >
                        {t("Off Day")}
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
            const result = await updateSchedule(editingSchedule.id, data);
            if (result.sessionsGenerated) setLastGenerated(result.sessionsGenerated);
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

type BranchConflict = { currentBranches: number; allowedBranches: number; planName: string };
type PaymentModal = { planId: string; planName: string; planPrice: number; walletBalance: number };

function BillingTab() {
  const { org, subscription, plans, branches, isLoading, upgradePlan, refresh } = useOrg();
  const { t, locale } = useLanguage();
  const [searchParams] = useSearchParams();

  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast]           = useState<{ ok: boolean; msg: string } | null>(null);
  const [conflict, setConflict]     = useState<(BranchConflict & { planId: string }) | null>(null);
  const [removingBranch, setRemovingBranch] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModal | null>(null);
  const [iframeModal, setIframeModal] = useState<{ iframeUrl: string; planName: string; planPrice: number } | null>(null);

  // Invoices (billing history)
  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoicePage, setInvoicePage]   = useState(1);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // Load invoices
  const loadInvoices = useCallback(async (page = 1) => {
    if (!org) return;
    setInvoicesLoading(true);
    try {
      const { invoices: list, total } = await orgService.getInvoices(org.id, page);
      setInvoices(list);
      setInvoiceTotal(total);
      setInvoicePage(page);
    } catch {
      // silent — keep existing list on error
    } finally {
      setInvoicesLoading(false);
    }
  }, [org]);

  useEffect(() => { loadInvoices(1); }, [loadInvoices]);

  // Handle Paymob redirect back to billing tab (?payment=success/failed)
  useEffect(() => {
    const paymentResult = searchParams.get("payment");
    if (paymentResult === "success") {
      showToast(true, t("Payment successful"));
      void refresh();
      void loadInvoices(1);
    } else if (paymentResult === "failed") {
      showToast(false, t("Payment failed"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <Skeleton />;

  // ── Initiate plan purchase ────────────────────────────────────────────────
  async function handleSelectPlan(planId: string) {
    if (!org) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    // For free plan, skip modal and activate immediately
    if (plan.pricePerMonth === 0) {
      setProcessing(planId);
      try {
        const result = await orgService.purchasePlan(org.id, planId);
        if (result.method === "free") {
          await refresh();
          await loadInvoices(1);
          showToast(true, t("Plan activated successfully"));
        }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string; message?: string; details?: { currentBranches: number; allowedBranches: number; planName: string } } } };
        if (e?.response?.data?.error === "BRANCH_LIMIT_EXCEEDED" && e.response!.data!.details) {
          setConflict({ ...e.response!.data!.details, planId });
        } else {
          showToast(false, e?.response?.data?.message ?? t("Failed to activate plan. Please try again."));
        }
      }
      setProcessing(null);
      return;
    }

    // For paid plans: show confirmation dialog first
    setPaymentModal({ planId, planName: plan.name, planPrice: plan.pricePerMonth, walletBalance: 0 });
    setProcessing(null);
  }

  async function handleConfirmUpgrade() {
    if (!paymentModal || !org) return;
    const { planId, planName, planPrice } = paymentModal;
    setPaymentModal(null);
    setProcessing(planId);
    try {
      const result = await orgService.purchasePlan(org.id, planId);
      if (result.method === "wallet") {
        await refresh();
        await loadInvoices(1);
        const currency = locale === "ar" ? "ج.م" : "EGP";
        showToast(true,
          locale === "ar"
            ? `تم ترقية خطتك إلى ${planName}. تم خصم ${planPrice} ${currency} من محفظتك.`
            : `Your plan has been upgraded to ${planName}. ${planPrice} ${currency} has been deducted from your wallet.`
        );
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; message?: string; details?: { currentBranches: number; allowedBranches: number; planName: string } } } };
      const errCode = e?.response?.data?.error;
      if (errCode === "BRANCH_LIMIT_EXCEEDED" && e?.response?.data?.details) {
        setConflict({ ...e.response!.data!.details, planId });
      } else if (errCode === "PAYMOB_NOT_CONFIGURED" || errCode === "PAYMOB_ERROR") {
        showToast(false,
          locale === "ar"
                ? "الدفع عبر Paymob غير متاح حالياً. يرجى إضافة رصيد إلى محفظتك أولاً."
              : "Paymob payment is unavailable. Please add funds to your wallet first."
        );
      } else if (e?.response?.data?.error === "INSUFFICIENT_WALLET") {
        try {
          const checkout = await paymentService.startSubscriptionCheckout(org.id, { planId });
          window.location.assign(checkout.checkoutUrl);
        } catch {
          showToast(false, e?.response?.data?.message ?? t("Payment failed"));
        }
      } else {
        showToast(false, e?.response?.data?.message ?? t("Payment failed"));
      }
    }
    setProcessing(null);
  }

  async function handleRemoveBranchForConflict(branchId: string) {
    if (!conflict || !org) return;
    setRemovingBranch(branchId);
    try {
      await orgService.deleteBranch(org.id, branchId);
      await refresh();
      const updatedCount = branches.filter((b) => b.id !== branchId).length;
      if (updatedCount <= conflict.allowedBranches) {
        setConflict(null);
        await handleSelectPlan(conflict.planId);
      } else {
        setConflict((prev) => prev ? { ...prev, currentBranches: updatedCount } : null);
      }
    } catch {
      showToast(false, t("Failed to remove branch. Please try again."));
    }
    setRemovingBranch(null);
  }

  // ── PDF receipt download (jsPDF) ──────────────────────────────────────────
  async function handleDownloadReceipt(inv: Invoice) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const isAr = locale === "ar";
    const currency = isAr ? "ج.م" : "EGP";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Waitless", 105, 22, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Clinic Queue Management Platform", 105, 30, { align: "center" });

    doc.setDrawColor(220);
    doc.line(14, 36, 196, 36);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(isAr ? "فاتورة" : "Invoice", 14, 47);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);

    const rows: [string, string][] = [
      [isAr ? "رقم الفاتورة" : "Invoice Number", inv.invoiceNumber || "-"],
      [isAr ? "التاريخ" : "Date",               new Date(inv.createdAt).toLocaleDateString("en-EG")],
      [isAr ? "الخطة" : "Plan",                 inv.planName],
      [isAr ? "طريقة الدفع" : "Payment Method",
        inv.paymentMethod === "wallet" ? (isAr ? "محفظة" : "Wallet")
        : inv.paymentMethod === "paymob"  ? (isAr ? "Paymob" : "Paymob")
        : (isAr ? "يدوي" : "Manual")],
      [isAr ? "بداية الفترة" : "Period Start",  new Date(inv.periodStart).toLocaleDateString("en-EG")],
      [isAr ? "نهاية الفترة" : "Period End",    new Date(inv.periodEnd).toLocaleDateString("en-EG")],
      [isAr ? "الحالة" : "Status",              inv.status === "paid" ? (isAr ? "مدفوعة" : "Paid") : inv.status],
    ];

    let y = 58;
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label + ":", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 80, y);
      y += 9;
    });

    if (inv.paymobTransactionId) {
      doc.setFont("helvetica", "bold");
      doc.text("Transaction ID:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(inv.paymobTransactionId, 80, y);
      y += 9;
    }

    doc.setDrawColor(220);
    doc.line(14, y + 4, 196, y + 4);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(isAr ? "الإجمالي:" : "Total:", 14, y + 16);
    doc.setTextColor(180, 140, 0);
    doc.text(`${inv.amount} ${currency}`, 196, y + 16, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text("Waitless • support@waitless.app", 105, 285, { align: "center" });

    doc.save(`invoice-${inv.invoiceNumber || inv.id}.pdf`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const tierOrder: Record<string, number> = { trial: 0, starter: 1, growth: 2, enterprise: 3, "business+": 4 };
  const sortedPlans = [...plans].sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          toast.ok
            ? "border-success/30 bg-success/5 text-success"
            : "border-danger/30 bg-danger/5 text-danger"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Plan cards ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 font-heading text-base font-bold text-navy">{t("Subscription Plans")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
          {sortedPlans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;
            const isBusy    = processing === plan.id;
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-xl border p-5 transition ${
                  isCurrent
                    ? "border-gold bg-gold-tint shadow-md"
                    : plan.tier === "business+"
                      ? "border-navy/30 bg-navy/5"
                      : "border-border bg-white"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-heading text-base font-bold text-navy">
                      {plan.name}
                      {plan.tier === "business+" && (
                        <span className="ml-1.5 rounded-full bg-navy px-2 py-0.5 text-xs font-semibold text-white">
                          {t("Top")}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-gold">
                      {plan.pricePerMonth === 0
                        ? t("Free")
                        : `${plan.pricePerMonth} ${locale === "ar" ? "ج.م" : "EGP"}`}
                      {plan.pricePerMonth > 0 && (
                        <span className="text-xs font-normal text-navy-mid">/{t("mo")}</span>
                      )}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-navy">
                      {t("Current Plan")}
                    </span>
                  )}
                </div>

                <ul className="mt-3 flex-1 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-navy-mid">
                      <span className="mt-0.5 shrink-0 text-success">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  {isCurrent ? (
                    <div className="w-full rounded-md border border-gold/40 py-2 text-center text-sm font-medium text-gold">
                      {t("Current Plan")}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isBusy}
                      className={`w-full rounded-md border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
                        plan.tier === "business+"
                          ? "border-navy bg-navy text-white hover:bg-navy/90"
                          : "border-navy text-navy hover:bg-navy hover:text-white"
                      }`}
                    >
                      {isBusy ? t("Processing…") : t("Select Plan")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Billing History ─────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 font-heading text-base font-bold text-navy">{t("Billing History")}</h2>

        {invoicesLoading ? (
          <Skeleton />
        ) : invoices.length === 0 ? (
          <div className="rounded-xl border border-border bg-offwhite py-10 text-center">
            <p className="text-2xl">🧾</p>
            <p className="mt-2 text-sm text-navy-mid">{t("No invoices yet.")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-offwhite text-xs font-semibold uppercase tracking-wide text-navy-mid">
                <tr>
                  <th className="px-4 py-3 text-left">{t("Invoice")}</th>
                  <th className="px-4 py-3 text-left">{t("Date")}</th>
                  <th className="px-4 py-3 text-left">{t("Plan")}</th>
                  <th className="px-4 py-3 text-right">{t("Amount")}</th>
                  <th className="px-4 py-3 text-left">{t("Payment Method")}</th>
                  <th className="px-4 py-3 text-left">{t("Status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-offwhite/50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-navy">{inv.invoiceNumber || "—"}</td>
                    <td className="px-4 py-3 text-navy-mid">
                      {new Date(inv.createdAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-EG", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">{inv.planName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gold">
                      {inv.amount} {locale === "ar" ? "ج.م" : "EGP"}
                    </td>
                    <td className="px-4 py-3 text-navy-mid">
                      {inv.paymentMethod === "wallet"
                        ? t("Pay from Wallet")
                        : inv.paymentMethod === "paymob"
                          ? t("Paymob Checkout")
                          : t("Manual")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        inv.status === "paid"     ? "bg-success/10 text-success"
                        : inv.status === "failed" ? "bg-danger/10 text-danger"
                        : "bg-navy/10 text-navy"
                      }`}>
                        {inv.status === "paid"     ? t("Paid")
                         : inv.status === "failed" ? t("Failed")
                         : t("Refunded")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDownloadReceipt(inv)}
                        className="text-xs font-medium text-gold hover:text-gold-light transition"
                      >
                        {t("Download Receipt")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {invoiceTotal > 20 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-navy-mid">
                <span>{t("Showing")} {invoices.length} / {invoiceTotal}</span>
                <div className="flex gap-2">
                  <button
                    disabled={invoicePage <= 1}
                    onClick={() => loadInvoices(invoicePage - 1)}
                    className="rounded border border-border px-2 py-1 hover:bg-offwhite disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    disabled={invoicePage * 20 >= invoiceTotal}
                    onClick={() => loadInvoices(invoicePage + 1)}
                    className="rounded border border-border px-2 py-1 hover:bg-offwhite disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Upgrade confirmation modal ───────────────────────────────────── */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-fade-up rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-heading text-xl font-bold text-navy">{t("Confirm Upgrade")}</h2>
            <p className="mt-2 text-sm text-navy-mid">
              {locale === "ar"
                ? `هل أنت متأكد أنك تريد الترقية إلى خطة ${paymentModal.planName} مقابل ${paymentModal.planPrice} ${
                    "ج.م"
                  }/شهر؟`
                : `Upgrade to ${paymentModal.planName} for ${paymentModal.planPrice} EGP/month?`}
            </p>
            <p className="mt-1 text-xs text-navy-mid">
              {locale === "ar"
                ? "سيتم الخصم من محفظتك إن كان الرصيد كافياً، وإلا سيتم تحويلك إلى Paymob."
                : "Payment will be deducted from your wallet if balance is sufficient, otherwise you'll be redirected to Paymob."}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setPaymentModal(null)}
                className="flex-1 rounded-md border border-border py-2.5 text-sm font-medium text-navy-mid transition hover:border-navy hover:text-navy"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={() => void handleConfirmUpgrade()}
                className="flex-1 rounded-md bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-navy/90"
              >
                {t("Confirm Upgrade")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Paymob iframe modal ──────────────────────────────────────────── */}
      {iframeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl animate-fade-up rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-navy">
                {t("Complete Payment")} — {iframeModal.planName}
              </h2>
              <button
                onClick={() => setIframeModal(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-navy-mid transition hover:border-navy hover:text-navy"
              >
                {t("Close")}
              </button>
            </div>
            <iframe
              src={iframeModal.iframeUrl}
              className="h-[600px] w-full rounded-lg border border-border"
              title="Paymob Checkout"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
            />
          </div>
        </div>
      )}

      {/* ── Branch conflict modal ────────────────────────────────────────── */}
      {conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-fade-up rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-heading text-xl font-bold text-navy">{t("Branch Limit Exceeded")}</h2>
            <p className="mt-2 text-sm text-navy-mid">
              {t("You have")} <strong className="text-navy">{conflict.currentBranches}</strong>{" "}
              {t("active branches, but the")}{" "}
              <strong className="text-navy">{conflict.planName}</strong>{" "}
              {t("plan allows only")}{" "}
              <strong className="text-navy">{conflict.allowedBranches}</strong>.{" "}
              {t("Remove")} {conflict.currentBranches - conflict.allowedBranches}{" "}
              {t("branch(es) to continue.")}
            </p>
            <div className="mt-4 space-y-2">
              {branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <p className="text-sm font-medium text-navy">{b.name}</p>
                  <button
                    onClick={() => handleRemoveBranchForConflict(b.id)}
                    disabled={removingBranch === b.id}
                    className="rounded-md bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger hover:text-white disabled:opacity-50"
                  >
                    {removingBranch === b.id ? "…" : t("Remove")}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setConflict(null)}
              className="mt-4 w-full rounded-md border border-border py-2.5 text-sm font-medium text-navy-mid transition hover:border-navy hover:text-navy"
            >
              {t("Keep Current Plan")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WhatsApp Tab ──────────────────────────────────────────────────────────────

function WhatsAppTab() {
  const { org, subscription, plans, isLoading, updateOrg } = useOrg();
  const { t } = useLanguage();
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
        <p className="mt-3 font-heading text-lg font-bold text-navy">{t("WhatsApp Notifications")}</p>
        <p className="mt-1 text-sm text-navy-mid">
          {t("Your current plan does not include WhatsApp notifications.")}
        </p>
        <p className="mt-1 text-sm text-navy-mid">
          {t("Upgrade to Standard or Enterprise to enable this feature.")}
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
        {t("Set a WhatsApp number to send automated appointment reminders to patients.")}
      </p>

      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"}`}>
          {result.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <ModalField
          label={t("WhatsApp Number (E.164 format)")}
          value={number}
          onChange={setNumber}
          placeholder="+201XXXXXXXXX"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold px-6 py-2 text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
        >
          {saving ? t("Saving…") : t("Save Number")}
        </button>
      </form>
    </div>
  );
}

// ── Wallet Tab ────────────────────────────────────────────────────────────────

function WalletTab() {
  const { org, branches } = useOrg();
  const { t, locale } = useLanguage();
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
    <div className="space-y-8">
      {/* Organization Wallet (balance + top-up + wallet entries) */}
      <WalletView orgId={orgId} />

      {/* Session Revenue — detailed transaction list from completed appointments */}
      <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-navy">{t("Session Revenue")}</h2>
          <p className="text-sm text-navy-mid">{t("Revenue from completed appointments")}</p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-navy-mid transition hover:border-navy hover:text-navy"
        >
          ↻ {t("Refresh")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-offwhite p-4 text-center">
          <p className="text-xs text-navy-mid">{t("Total Earnings")}</p>
          <p className="mt-1 font-heading text-2xl font-bold text-navy">
            {loadingSummary ? "…" : `${(summary?.totalEarnings ?? 0).toLocaleString()} ${locale === "ar" ? "ج.م" : "EGP"}`}
          </p>
        </div>
        <div className="rounded-xl border border-gold/30 bg-gold-tint p-4 text-center">
          <p className="text-xs text-navy-mid">{t("This Month")}</p>
          <p className="mt-1 font-heading text-2xl font-bold text-gold">
            {loadingSummary ? "…" : `${(summary?.thisMonthEarnings ?? 0).toLocaleString()} ${locale === "ar" ? "ج.م" : "EGP"}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-offwhite p-4 text-center">
          <p className="text-xs text-navy-mid">{t("Pending")}</p>
          <p className="mt-1 font-heading text-2xl font-bold text-navy-mid">
            {loadingSummary ? "…" : `${(summary?.pendingAmount ?? 0).toLocaleString()} ${locale === "ar" ? "ج.م" : "EGP"}`}
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
          <option value="">{t("All Branches")}</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold"
        >
          <option value="">{t("All Status")}</option>
          <option value="settled">{t("Settled")}</option>
          <option value="pending">{t("Pending")}</option>
          <option value="refunded">{t("Refunded")}</option>
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
            {t("Clear")}
          </button>
        )}
      </div>

      {/* Transaction list */}
      {loadingTx ? (
        <Skeleton />
      ) : transactions.length === 0 ? (
        <EmptyState icon="💳" title={t("No transactions yet")} body={t("Completed appointments will appear here as settled transactions.")} />
      ) : (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-5 bg-offwhite px-4 py-2 text-xs font-semibold uppercase tracking-wide text-navy-mid">
              <span className="col-span-2">{t("Patient / Branch")}</span>
              <span className="text-right">{t("Gross")}</span>
              <span className="text-right">{t("Commission")}</span>
              <span className="text-right">{t("Status")}</span>
            </div>
            {transactions.map((tx) => (
              <div key={tx.id} className="grid grid-cols-5 items-center gap-2 px-4 py-3">
                <div className="col-span-2">
                  <p className="text-sm font-medium text-navy">{tx.patientName || "—"}</p>
                  <p className="text-xs text-navy-mid">{tx.branchName} · {tx.createdAt.slice(0, 10)}</p>
                </div>
                <p className="text-right text-sm font-medium text-navy">{tx.grossAmount} {tx.currency}</p>
                <p className="text-right text-sm font-semibold text-gold">+{tx.orgNet} {tx.currency}</p>
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
              <span className="text-navy-mid">{total} {t("total transactions")}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-border px-3 py-1.5 text-navy-mid disabled:opacity-40 hover:border-gold hover:text-gold"
                >
                  {t("← Prev")}
                </button>
                <span className="flex items-center px-2 text-navy-mid">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-border px-3 py-1.5 text-navy-mid disabled:opacity-40 hover:border-gold hover:text-gold"
                >
                  {t("Next →")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const { org, branches, updateOrg, refresh } = useOrg();
  const { t } = useLanguage();
  const orgId = org?.id ?? "";

  const [orgName, setOrgName] = useState(org?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameResult, setNameResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Commission editing removed — org receives full post-platform revenue.

  async function handleSaveName(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!orgName.trim() || orgName.trim() === org?.name) return;
    setSavingName(true);
    setNameResult(null);
    const result = await updateOrg({ name: orgName.trim() });
    setNameResult({ ok: result.ok, msg: result.ok ? t("Saved!") : (result.error ?? t("Failed")) });
    setSavingName(false);
  }

  return (
    <div className="space-y-7">
      {/* Org name */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-mid">{t("Organization Name")}</p>
        <form onSubmit={handleSaveName} className="flex gap-2">
          <input
            value={orgName}
            onChange={(e) => { setOrgName(e.target.value); setNameResult(null); }}
            className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            placeholder={t("Organization name")}
          />
          <button
            type="submit"
            disabled={savingName || !orgName.trim() || orgName.trim() === org?.name}
            className="h-10 rounded-lg bg-gold px-4 text-sm font-semibold text-navy disabled:opacity-50 hover:bg-gold-light"
          >
            {savingName ? t("Saving…") : t("Save")}
          </button>
        </form>
        {nameResult && (
          <p className={`mt-1.5 text-xs ${nameResult.ok ? "text-success" : "text-danger"}`}>{nameResult.msg}</p>
        )}
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

const EGYPTIAN_CITIES = [
  { key: "cairo",            en: "Cairo",                   ar: "القاهرة" },
  { key: "alexandria",       en: "Alexandria",              ar: "الإسكندرية" },
  { key: "giza",             en: "Giza",                    ar: "الجيزة" },
  { key: "port_said",        en: "Port Said",               ar: "بورسعيد" },
  { key: "suez",             en: "Suez",                    ar: "السويس" },
  { key: "ismailia",         en: "Ismailia",                ar: "الإسماعيلية" },
  { key: "damietta",         en: "Damietta",                ar: "دمياط" },
  { key: "luxor",            en: "Luxor",                   ar: "الأقصر" },
  { key: "aswan",            en: "Aswan",                   ar: "أسوان" },
  { key: "asyut",            en: "Asyut",                   ar: "أسيوط" },
  { key: "sohag",            en: "Sohag",                   ar: "سوهاج" },
  { key: "qena",             en: "Qena",                    ar: "قنا" },
  { key: "minya",            en: "Minya",                   ar: "المنيا" },
  { key: "beni_suef",        en: "Beni Suef",               ar: "بني سويف" },
  { key: "faiyum",           en: "Faiyum",                  ar: "الفيوم" },
  { key: "dakahlia",         en: "Dakahlia (Mansoura)",     ar: "الدقهلية (المنصورة)" },
  { key: "sharqia",          en: "Sharqia (Zagazig)",       ar: "الشرقية (الزقازيق)" },
  { key: "qalyubia",         en: "Qalyubia (Banha)",        ar: "القليوبية (بنها)" },
  { key: "kafr_el_sheikh",   en: "Kafr El Sheikh",          ar: "كفر الشيخ" },
  { key: "gharbia",          en: "Gharbia (Tanta)",         ar: "الغربية (طنطا)" },
  { key: "monufia",          en: "Monufia (Shibin El Kom)", ar: "المنوفية (شبين الكوم)" },
  { key: "beheira",          en: "Beheira (Damanhur)",      ar: "البحيرة (دمنهور)" },
  { key: "matruh",           en: "Matruh",                  ar: "مطروح" },
  { key: "north_sinai",      en: "North Sinai (Arish)",     ar: "شمال سيناء (العريش)" },
  { key: "south_sinai",      en: "South Sinai (Sharm)",     ar: "جنوب سيناء (شرم الشيخ)" },
  { key: "red_sea",          en: "Red Sea (Hurghada)",      ar: "البحر الأحمر (الغردقة)" },
  { key: "new_valley",       en: "New Valley (Kharga)",     ar: "الوادي الجديد (الخارجة)" },
  { key: "new_cairo",        en: "New Cairo",               ar: "القاهرة الجديدة" },
  { key: "6th_october",      en: "6th of October City",     ar: "مدينة السادس من أكتوبر" },
  { key: "nasr_city",        en: "Nasr City",               ar: "مدينة نصر" },
  { key: "maadi",            en: "Maadi",                   ar: "المعادي" },
  { key: "helwan",           en: "Helwan",                  ar: "حلوان" },
  { key: "shubra_el_kheima", en: "Shubra El Kheima",        ar: "شبرا الخيمة" },
  { key: "10th_ramadan",     en: "10th of Ramadan City",    ar: "مدينة العاشر من رمضان" },
] as const;

type CityKey = typeof EGYPTIAN_CITIES[number]["key"];

function AddBranchModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: Omit<Branch, "id" | "orgId">) => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState<CityKey>("cairo");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (phone.trim()) {
      const ph = validatePhone(phone.trim());
      if (!ph.valid) { setPhoneError(t(ph.error)); return; }
    }
    setPhoneError("");
    setSaving(true);
    await onSave({ name: name.trim(), address: address.trim(), city, phone: phone.trim() ? toE164(phone.trim()) : "" });
    setSaving(false);
  }

  return (
    <ModalShell title={t("Add Branch")} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <ModalField label={t("Branch Name *")} value={name} onChange={setName} placeholder="Maadi Branch" />
        <ModalField label={t("Address *")} value={address} onChange={setAddress} placeholder="15 Road 9, Maadi" />
        <div>
          <label className="block text-sm font-medium text-navy">{t("City *")}</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value as CityKey)}
            className="mt-1.5 h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            {EGYPTIAN_CITIES.map((c) => (
              <option key={c.key} value={c.key}>
                {locale === "ar" ? c.ar : c.en}
              </option>
            ))}
          </select>
        </div>
        <div>
          <ModalField label={t("Phone")} value={phone} onChange={(v) => { setPhone(v); setPhoneError(""); }} placeholder="01XXXXXXXXX" inputMode="numeric" />
          {phoneError && <p className="mt-1 text-xs text-danger">{phoneError}</p>}
        </div>
        <ModalActions onClose={onClose} saving={saving} label={t("Add Branch")} />
      </form>
    </ModalShell>
  );
}

function EditBranchModal({
  branch, orgId, onClose, onSaved,
}: {
  branch: Branch;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const { refresh } = useOrg();
  const [name, setName] = useState(branch.name);
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [phoneError, setPhoneError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (phone.trim()) {
      const ph = validatePhone(phone.trim());
      if (!ph.valid) { setPhoneError(t(ph.error)); return; }
    }
    setPhoneError("");
    setSaving(true);
    try {
      await orgService.updateBranch(orgId, branch.id, {
        name: name.trim(),
        phone: phone.trim() ? toE164(phone.trim()) : "",
      });
      await refresh();
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("Failed to save.");
      setError(msg);
    }
    setSaving(false);
  }

  return (
    <ModalShell title={t("Edit Branch")} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <ModalField label={t("Branch Name *")} value={name} onChange={setName} placeholder="Maadi Branch" />
        <div>
          <ModalField label={t("Phone")} value={phone} onChange={(v) => { setPhone(v); setPhoneError(""); }} placeholder="01XXXXXXXXX" inputMode="numeric" />
          {phoneError && <p className="mt-1 text-xs text-danger">{phoneError}</p>}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <ModalActions onClose={onClose} saving={saving} label={t("Save Changes")} />
      </form>
    </ModalShell>
  );
}

function InviteStaffModal({
  branches,
  doctorLimit,
  receptionistLimit,
  activeDocCount,
  activeReceptCount,
  onClose,
  onSave,
}: {
  branches: Branch[];
  doctorLimit: number;
  receptionistLimit: number;
  activeDocCount: number;
  activeReceptCount: number;
  onClose: () => void;
  onSave: (branchId: string, email: string, role: Membership["userRole"], specialties?: string[]) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"doctor" | "receptionist">("doctor");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [specialties, setSpecialties] = useState("");
  const [saving, setSaving] = useState(false);

  const doctorAtLimit = isFinite(doctorLimit) && activeDocCount >= doctorLimit;
  const receptionistAtLimit = isFinite(receptionistLimit) && activeReceptCount >= receptionistLimit;
  const receptionistBlocked = receptionistLimit === 0;

  const roleAtLimit = role === "doctor" ? doctorAtLimit : (receptionistBlocked || receptionistAtLimit);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || roleAtLimit) return;
    setSaving(true);
    const specialtiesArr = role === "doctor" && specialties.trim()
      ? specialties.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    await onSave(branchId, email.trim(), role, specialtiesArr);
    setSaving(false);
  }

  return (
    <ModalShell title={t("Invite Staff Member")} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <ModalField label={t("Email Address *")} value={email} onChange={setEmail} placeholder="staff@clinic.eg" type="email" />

        <div>
          <label className="block text-sm font-medium text-navy">{t("Role")}</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["doctor", "receptionist"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md border py-2 text-xs font-medium transition ${
                  role === r ? "border-navy bg-navy text-white" : "border-border text-navy-mid hover:border-navy/40"
                }`}
              >
                {t(r)}
              </button>
            ))}
          </div>
          {roleAtLimit && (
            <p className="mt-1.5 text-xs text-danger">
              {role === "receptionist" && receptionistBlocked
                ? t("Receptionists are not available on your current plan.")
                : role === "doctor"
                  ? t("Doctor limit reached. Upgrade to add more.")
                  : t("Receptionist limit reached. Upgrade to add more.")}
            </p>
          )}
        </div>

        {role === "doctor" && (
          <ModalField
            label={t("Specialties (comma-separated)")}
            value={specialties}
            onChange={setSpecialties}
            placeholder="Cardiology, Internal Medicine"
          />
        )}

        {branches.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-navy">{t("Branch")}</label>
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

        <ModalActions onClose={onClose} saving={saving} label={t("Send Invitation")} disabled={roleAtLimit} />
      </form>
    </ModalShell>
  );
}

function EditMemberModal({
  member,
  branches,
  onClose,
  onSave,
}: {
  member: Membership;
  branches: Branch[];
  onClose: () => void;
  onSave: (data: { kind?: Membership["userRole"]; specialties?: string[]; bio?: string; branches?: string[] }) => Promise<void>;
}) {
  const { t } = useLanguage();
  const initialRole: "doctor" | "receptionist" = member.userRole === "receptionist" ? "receptionist" : "doctor";
  const [role, setRole] = useState<"doctor" | "receptionist">(initialRole);
  const [specialties, setSpecialties] = useState(member.specialties?.join(", ") ?? "");
  const [bio, setBio] = useState(member.bio ?? "");
  const [selectedBranches, setSelectedBranches] = useState<string[]>(
    member.branchId ? [member.branchId] : (branches[0] ? [branches[0].id] : []),
  );
  const [saving, setSaving] = useState(false);

  function toggleBranch(id: string) {
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data: { kind?: Membership["userRole"]; specialties?: string[]; bio?: string; branches?: string[] } = {};
    if (role !== member.userRole) data.kind = role;
    if (role === "doctor") {
      const arr = specialties.split(",").map((s) => s.trim()).filter(Boolean);
      if (arr.length) data.specialties = arr;
    }
    if (role === "receptionist") {
      data.branches = selectedBranches;
    }
    if (bio.trim()) data.bio = bio.trim();
    await onSave(data);
    setSaving(false);
  }

  return (
    <ModalShell title={t("Edit Staff Member")} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-md bg-offwhite px-4 py-3">
          <p className="font-medium text-navy">{member.memberName || "—"}</p>
          <p className="text-xs text-navy-mid">{member.invitedEmail}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy">{t("Role")}</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["doctor", "receptionist"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md border py-2 text-xs font-medium transition ${
                  role === r ? "border-navy bg-navy text-white" : "border-border text-navy-mid hover:border-navy/40"
                }`}
              >
                {t(r)}
              </button>
            ))}
          </div>
          {role !== member.userRole && (
            <p className="mt-1.5 text-xs text-gold">{t("Role change will take effect immediately (once per 30 days).")}</p>
          )}
        </div>

        {role === "doctor" && (
          <ModalField
            label={t("Specialties (comma-separated)")}
            value={specialties}
            onChange={setSpecialties}
            placeholder="Cardiology, Internal Medicine"
          />
        )}

        {role === "receptionist" && branches.length > 0 && (
          <div>
            <p className="text-sm font-medium text-navy">{t("Assigned Branches *")}</p>
            <div className="mt-1.5 space-y-1.5">
              {branches.map((b) => (
                <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm text-navy-mid">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className="rounded border-border"
                  />
                  {b.name}
                </label>
              ))}
            </div>
            {selectedBranches.length === 0 && (
              <p className="mt-1 text-xs text-danger">{t("At least one branch is required.")}</p>
            )}
          </div>
        )}

        <ModalField label={t("Bio")} value={bio} onChange={setBio} placeholder={t("Brief bio or notes...")} />

        <ModalActions
          onClose={onClose}
          saving={saving}
          label={t("Save Changes")}
          disabled={role === "receptionist" && selectedBranches.length === 0}
        />
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
  const [defaultMax, setDefaultMax] = useState(
    initialValues?.defaultMaxBookings != null ? String(initialValues.defaultMaxBookings) : "",
  );
  const [saving, setSaving] = useState(false);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  type Slot = { start: string; end: string };
  // A day can hold more than one time range (e.g. a morning and an evening
  // session), so each day maps to an array of slots rather than a single one.
  const [selectedDays, setSelectedDays] = useState<Record<number, Slot[]>>(() => {
    if (!initialValues?.weeklySlots.length) return { 1: [{ start: "09:00", end: "13:00" }] };
    const byDay: Record<number, Slot[]> = {};
    for (const s of initialValues.weeklySlots) {
      (byDay[s.dayOfWeek] ??= []).push({ start: s.startTime, end: s.endTime });
    }
    return byDay;
  });

  function toggleDay(idx: number) {
    setSelectedDays((prev) => {
      const next = { ...prev };
      if (next[idx]) {
        delete next[idx];
      } else {
        next[idx] = [{ start: "09:00", end: "13:00" }];
      }
      return next;
    });
  }

  function addSlot(dow: number) {
    setSelectedDays((prev) => ({
      ...prev,
      [dow]: [...(prev[dow] ?? []), { start: "14:00", end: "17:00" }],
    }));
  }

  function removeSlot(dow: number, slotIdx: number) {
    setSelectedDays((prev) => {
      const remaining = (prev[dow] ?? []).filter((_, i) => i !== slotIdx);
      if (remaining.length === 0) {
        const next = { ...prev };
        delete next[dow];
        return next;
      }
      return { ...prev, [dow]: remaining };
    });
  }

  function updateSlot(dow: number, slotIdx: number, field: keyof Slot, value: string) {
    setSelectedDays((prev) => ({
      ...prev,
      [dow]: (prev[dow] ?? []).map((slot, i) => (i === slotIdx ? { ...slot, [field]: value } : slot)),
    }));
  }

  // Validate before saving: each slot's own range must make sense, and slots
  // on the same day must not overlap. Checked client-side so the admin sees
  // the problem immediately instead of round-tripping to the server.
  const scheduleError = useMemo(() => {
    if (Object.keys(selectedDays).length === 0) return "Select at least one day.";
    for (const [dow, slots] of Object.entries(selectedDays)) {
      const dayLabel = days[Number(dow)];
      for (const slot of slots) {
        if (!slot.start || !slot.end) return `${dayLabel}: pick both a start and end time.`;
        if (slot.start >= slot.end) return `${dayLabel}: end time must be after start time.`;
      }
      const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start < sorted[i - 1].end) return `${dayLabel}: time ranges overlap — adjust them so they don't cross.`;
      }
    }
    return null;
    // `days` is a new array reference each render but its contents never
    // change — omitting it keeps this memo from recomputing on unrelated
    // re-renders (e.g. every keystroke in the fee field).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDays]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (scheduleError) return;
    const foundDoctor = doctors.find((d) => d.id === doctorId);
    if (!isEditMode && !foundDoctor) return;
    const doctorDisplayName = foundDoctor?.memberName ?? initialValues?.doctorName ?? "";
    setSaving(true);
    await onSave({
      doctorId, // membership ID
      branchId,
      doctorName: doctorDisplayName,
      specialty,
      weeklySlots: Object.entries(selectedDays).flatMap(([dow, slots]) =>
        slots.map((slot) => ({
          dayOfWeek: Number(dow),
          startTime: slot.start,
          endTime:   slot.end,
        })),
      ),
      fee: Number(fee),
      avgConsultationMin: Number(avgMin),
      defaultMaxBookings: defaultMax.trim() !== "" ? Number(defaultMax) : null,
      isActive: true,
    });
    setSaving(false);
  }

  return (
    <ModalShell title={isEditMode ? "Edit Doctor Schedule" : "Add Doctor Schedule"} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">

        {/* Bug #6: Show doctor identity clearly in edit mode */}
        {isEditMode && initialValues && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-offwhite px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-sm font-bold text-white">
              {(initialValues.doctorName || "?").split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase()}
            </span>
            <div>
              <p className="font-heading text-sm font-bold text-navy">{initialValues.doctorName || "Unknown Doctor"}</p>
              <p className="text-xs text-navy-mid capitalize">{initialValues.specialty}</p>
            </div>
          </div>
        )}

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
          {Object.entries(selectedDays).map(([dow, slots]) => (
            <div key={dow} className="mt-2 space-y-1.5">
              {slots.map((slot, slotIdx) => (
                <div key={slotIdx} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 text-navy-mid">{slotIdx === 0 ? days[Number(dow)] : ""}</span>
                  <input
                    type="time"
                    value={slot.start}
                    onChange={(e) => updateSlot(Number(dow), slotIdx, "start", e.target.value)}
                    className="rounded border border-border px-2 py-1 text-xs"
                  />
                  <span>–</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={(e) => updateSlot(Number(dow), slotIdx, "end", e.target.value)}
                    className="rounded border border-border px-2 py-1 text-xs"
                  />
                  {slots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSlot(Number(dow), slotIdx)}
                      className="ml-1 text-navy-mid transition hover:text-danger"
                      title="Remove this time range"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addSlot(Number(dow))}
                className="ml-10 text-xs font-medium text-gold transition hover:text-gold-light"
              >
                + Add another time on {days[Number(dow)]}
              </button>
            </div>
          ))}
          {scheduleError && (
            <p className="mt-2 text-xs text-danger">{scheduleError}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Fee (EGP)" value={fee} onChange={setFee} placeholder="300" inputMode="numeric" />
          <ModalField label="Avg. Min / Patient" value={avgMin} onChange={setAvgMin} placeholder="12" inputMode="numeric" />
        </div>

        <ModalField
          label="Default Max Bookings (optional)"
          value={defaultMax}
          onChange={setDefaultMax}
          placeholder="Leave blank for unlimited"
          inputMode="numeric"
        />

        <ModalActions onClose={onClose} saving={saving} label={isEditMode ? "Save Changes" : "Create Schedule"} disabled={!!scheduleError} />
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
  const { t, locale } = useLanguage();
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
        <EmptyState icon="📅" title={t("No sessions")} body={t("No sessions found for this branch and date.")} />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {sessions.map((session) => {
            const isEditing = editingMax[session.id] !== undefined;
            const maxVal = isEditing ? editingMax[session.id] : session.maxBookings != null ? String(session.maxBookings) : "";
            return (
              <div key={session.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-navy">{session.doctorName || "Doctor"}</p>
                    <p className="mt-0.5 text-sm text-navy-mid">
                      {fmt12(session.startTime, locale)} – {fmt12(session.endTime, locale)}
                    </p>
                    <p className="text-xs text-navy-mid">{session.bookingsCount} {t("booked")}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Max slots editor */}
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-navy-mid">{t("Max slots")}</label>
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

function ModalActions({ onClose, saving, label, disabled }: { onClose: () => void; saving: boolean; label: string; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="flex h-10 w-full items-center justify-center rounded-md border border-border text-sm text-navy-mid transition hover:border-navy hover:text-navy"
      >
        {t("Cancel")}
      </button>
      <button
        type="submit"
        disabled={saving || disabled}
        className="flex h-10 w-full items-center justify-center rounded-md bg-gold text-sm font-medium text-navy transition hover:bg-gold-light disabled:opacity-60"
      >
        {saving ? t("Saving…") : label}
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
