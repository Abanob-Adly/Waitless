import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

// ── Static content ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "📋",
    title: "Smart Queue Management",
    desc: "Real-time digital queue with live position tracking for patients. Doctors control the flow — call, hold, skip, or complete with one tap.",
    theme: "navy",
  },
  {
    icon: "🗓️",
    title: "Automated Scheduling",
    desc: "Define weekly patterns once. Waitless auto-generates daily sessions, handles exceptions, and propagates changes to all upcoming dates.",
    theme: "gold",
  },
  {
    icon: "🏥",
    title: "Multi-Branch Support",
    desc: "Manage multiple clinic locations under one organization. Each branch has its own staff, schedules, and session capacity.",
    theme: "success",
  },
  {
    icon: "👨‍⚕️",
    title: "Staff & Role Management",
    desc: "Invite doctors and receptionists, assign roles, set permissions, and manage the full team from a single admin dashboard.",
    theme: "navy",
  },
  {
    icon: "💰",
    title: "Revenue & Wallets",
    desc: "Automatic commission splits at session completion. Track earnings per doctor, branch revenue, and organization wallet balance.",
    theme: "gold",
  },
  {
    icon: "📊",
    title: "Marketplace Visibility",
    desc: "Get discovered by patients searching by specialty and area. Your clinic appears in the Waitless marketplace with live session availability.",
    theme: "success",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    highlight: false,
    features: ["1 branch", "Up to 5 doctors", "2 receptionists", "Basic queue management", "Email support"],
    cta: "Get Started Free",
    tier: "trial",
  },
  {
    name: "Clinic",
    price: "299",
    period: "/mo",
    highlight: true,
    features: ["Up to 3 branches", "Up to 15 doctors", "10 receptionists", "Marketplace listing", "WhatsApp notifications", "Wallet & revenue reports", "Priority support"],
    cta: "Start Free Trial",
    tier: "clinic",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    highlight: false,
    features: ["Unlimited branches", "Unlimited doctors", "All Clinic features", "Custom integrations", "Dedicated account manager", "SLA guarantee"],
    cta: "Contact Sales",
    tier: "enterprise",
  },
];

const STEPS = [
  { num: "01", title: "Create Your Organization", desc: "Sign up, set up your clinic profile, and add your branches in minutes." },
  { num: "02", title: "Add Staff & Schedules", desc: "Invite doctors and receptionists. Define weekly schedule patterns — Waitless generates daily sessions automatically." },
  { num: "03", title: "Go Live", desc: "Patients book online or walk in. The queue runs itself — your staff just manages exceptions." },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function OrgLandingPage() {
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { t } = useLanguage();

  const isAdmin = authUser?.role === "admin";
  const isDoctor = authUser?.role === "doctor";

  function handleGetStarted() {
    if (isAdmin || isDoctor) {
      navigate("/admin");
    } else {
      navigate("/org/signup");
    }
  }

  return (
    <div className="bg-offwhite">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy px-6 py-20 text-center">
        {/* Background pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-5">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold" />
          <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-gold" />
        </div>

        <div className="relative mx-auto max-w-3xl animate-fade-up">
          <span className="inline-block rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold">
            {t("For Clinics & Healthcare Organizations")}
          </span>

          <h1 className="mt-5 font-heading text-5xl font-bold leading-tight text-white sm:text-6xl">
            {t("Modern Queue Management")}<br />
            <span className="text-gold">{t("for Your Clinic")}</span>
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-white/70">
            {t("Replace paper lists and phone calls with a digital queue system. Patients track their position live. Doctors control the flow. Your clinic runs smoother — starting today.")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleGetStarted}
              className="rounded-md bg-gold px-8 py-3.5 text-base font-semibold text-navy transition hover:bg-gold-light"
            >
              {isAdmin || isDoctor ? t("Go to Admin Dashboard →") : t("Get Started Free →")}
            </button>
            <button
              onClick={() => navigate("/search")}
              className="rounded-md border border-white/20 px-8 py-3.5 text-base font-medium text-white/80 transition hover:border-white/40 hover:text-white"
            >
              {t("Browse as Patient")}
            </button>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-8 text-sm text-white/50">
            <span>{t("✓ No setup fee")}</span>
            <span>{t("✓ Free starter plan")}</span>
            <span>{t("✓ Live in 10 minutes")}</span>
            <span>{t("✓ No code required")}</span>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-white px-6 py-8">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { value: "2,400+", label: "Patients managed" },
            { value: "80+",    label: "Doctors onboarded" },
            { value: "30s",    label: "Avg queue update interval" },
            { value: "99.9%",  label: "Queue accuracy" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-heading text-3xl font-bold text-navy">{s.value}</p>
              <p className="mt-0.5 text-xs text-navy-mid">{t(s.label)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-4xl font-bold text-navy">
              {t("Everything your clinic needs")}
            </h2>
            <p className="mt-3 text-navy-mid">
              {t("Built specifically for Egyptian healthcare providers. No generic software.")}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const themeMap = {
                navy:    "border-navy/10 bg-navy/5 text-navy",
                gold:    "border-gold/20 bg-gold-tint text-navy",
                success: "border-success/20 bg-success/5 text-navy",
              };
              return (
                <div
                  key={f.title}
                  className="animate-fade-up rounded-xl border border-border bg-white p-6 shadow-sm transition hover:shadow-md"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border text-2xl ${themeMap[f.theme as keyof typeof themeMap]}`}>
                    {f.icon}
                  </div>
                  <h3 className="font-heading text-base font-bold text-navy">{t(f.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-mid">{t(f.desc)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-navy px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center font-heading text-4xl font-bold text-white">
            Up and running in <span className="text-gold">{t("3 steps")}</span>
          </h2>

          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.num} className="rounded-xl border border-white/10 bg-white/5 p-6">
                <p className="font-heading text-4xl font-bold text-gold">{step.num}</p>
                <h3 className="mt-3 font-heading text-lg font-bold text-white">{t(step.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{t(step.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-4xl font-bold text-navy">{t("Simple, transparent pricing")}</h2>
            <p className="mt-3 text-navy-mid">{t("Start free. Upgrade when you grow.")}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-6 transition ${
                  plan.highlight
                    ? "border-gold bg-navy shadow-xl"
                    : "border-border bg-white shadow-sm"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1 text-xs font-bold text-navy">
                    {t("Most Popular")}
                  </span>
                )}

                <div className="mb-5">
                  <p className={`font-heading text-lg font-bold ${plan.highlight ? "text-white" : "text-navy"}`}>
                    {t(plan.name)}
                  </p>
                  <div className="mt-1 flex items-baseline gap-0.5">
                    <span className={`font-heading text-4xl font-bold ${plan.highlight ? "text-gold" : "text-navy"}`}>
                      {t(plan.price)}
                    </span>
                    {plan.period && (
                      <span className={`text-sm ${plan.highlight ? "text-white/60" : "text-navy-mid"}`}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 text-xs ${plan.highlight ? "text-white/40" : "text-navy-mid"}`}>EGP</p>
                </div>

                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? "text-white/80" : "text-navy-mid"}`}>
                      <span className="mt-0.5 text-success">✓</span>
                      {t(f)}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (isAdmin || isDoctor) {
                      navigate("/admin?tab=billing");
                    } else if (plan.tier === "enterprise") {
                      // placeholder
                    } else {
                      navigate("/org/signup");
                    }
                  }}
                  className={`w-full rounded-md py-3 text-sm font-semibold transition ${
                    plan.highlight
                      ? "bg-gold text-navy hover:bg-gold-light"
                      : "border border-navy text-navy hover:bg-navy hover:text-white"
                  }`}
                >
                  {isAdmin || isDoctor
                    ? plan.tier === "enterprise" ? t("Contact Sales") : t("Manage Plan →")
                    : t(plan.cta)}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Admin Dashboard preview (if logged in) ────────────────────────── */}
      {(isAdmin || isDoctor) && (
        <section className="border-t border-border bg-white px-6 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold">{t("You're logged in")}</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-navy">{t("Go to your Admin Dashboard")}</h2>
            <p className="mt-2 text-navy-mid">
              {t("Manage your clinic, view your queue, update schedules, and track revenue — all in one place.")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => navigate("/admin")}
                className="rounded-md bg-navy px-8 py-3 text-sm font-semibold text-white transition hover:bg-navy-mid"
              >
                {t("Open Dashboard →")}
              </button>
              <button
                onClick={() => navigate("/admin?tab=billing")}
                className="rounded-md border border-border px-8 py-3 text-sm font-medium text-navy-mid transition hover:border-navy hover:text-navy"
              >
                {t("View Billing Plans")}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA footer ────────────────────────────────────────────────────── */}
      {!isAdmin && !isDoctor && (
        <section className="bg-gold px-6 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-heading text-4xl font-bold text-navy">
              {t("Ready to modernize your clinic?")}
            </h2>
            <p className="mt-3 text-navy/70">
              {t("Join hundreds of clinics already saving time with Waitless.")}
            </p>
            <button
              onClick={() => navigate("/org/signup")}
              className="mt-8 rounded-md bg-navy px-10 py-3.5 text-base font-semibold text-white transition hover:bg-navy-mid"
            >
              {t("Create Your Clinic Account →")}
            </button>
            <p className="mt-3 text-xs text-navy/50">{t("Free to start · No credit card required")}</p>
          </div>
        </section>
      )}
    </div>
  );
}
