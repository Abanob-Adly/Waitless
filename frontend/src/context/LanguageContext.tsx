import { createContext, useContext, useEffect, useState } from "react";

type Locale = "en" | "ar";

interface LanguageContextValue {
  locale: Locale;
  toggleLocale: () => void;
  t: (text: string) => string;
}

// ── Arabic translation dictionary ──────────────────────────────────────────────
// Brand name "waitless" / "Waitless" is NEVER translated — values preserve it in
// English wherever it appears in a phrase.
const AR: Record<string, string> = {
  // ── Navbar ──────────────────────────────────────────────────────────────────
  "Home": "الرئيسية",
  "Find Doctors": "البحث عن أطباء",
  "My Bookings": "حجوزاتي",
  "Doctor Portal": "بوابة الطبيب",
  "Admin Portal": "بوابة الإدارة",
  "Reception": "الاستقبال",
  "For Clinics": "للعيادات",
  "Sign In": "تسجيل الدخول",
  "Get Started": "ابدأ الآن",
  "Find Doctor": "ابحث عن طبيب",
  "Signed in as": "مسجل دخول كـ",
  "Doctor": "طبيب",
  "Admin": "مدير",
  "Receptionist": "موظف استقبال",
  "Patient": "مريض",
  "My Dashboard": "لوحة التحكم",
  "My Live Ticket": "تذكرتي الحية",
  "Reception Portal": "بوابة الاستقبال",
  "Sign Out": "تسجيل الخروج",
  "DOB:": "تاريخ الميلاد:",

  // ── LandingPage — hero ───────────────────────────────────────────────────────
  "Egypt's #1 Healthcare Booking Platform": "منصة الحجز الصحي الأولى في مصر",
  "Book Your Doctor.": "احجز طبيبك.",
  "Skip the Wait.": "تخطَّ الانتظار.",
  "Find, compare and book appointments with Egypt's top specialists — online, instantly, no phone calls.":
    "ابحث وقارن واحجز مع أفضل المتخصصين في مصر — عبر الإنترنت، فوراً، بدون مكالمات هاتفية.",
  "Search Doctors": "ابحث عن أطباء",

  // ── LandingPage — stats ──────────────────────────────────────────────────────
  "Patients Served": "مريض تم خدمتهم",
  "Verified Doctors": "طبيب موثق",
  "Average Rating": "متوسط التقييم",
  "Specialties": "تخصص",

  // ── LandingPage — live ticket widget ────────────────────────────────────────
  "Your active booking": "حجزك النشط",
  "Live queue ticket": "تذكرة الطابور الحي",
  "Live": "مباشر",
  "your position": "موقعك",
  "Session start": "بدء الجلسة",
  "Fee": "الرسوم",
  "View full ticket →": "عرض التذكرة كاملة →",

  // ── LandingPage — top specialists ────────────────────────────────────────────
  "Highly rated — available now": "الأعلى تقييماً — متاح الآن",
  "Top Specialists": "أفضل المتخصصين",
  "View all →": "عرض الكل →",
  "Growing our network": "نمو شبكتنا",
  "Clinics and specialists are joining Waitless every week. Be among the first to list your practice and reach patients near you.":
    "تنضم العيادات والمتخصصون إلى Waitless كل أسبوع. كن من أوائل من يُدرج ممارسته ويصل إلى المرضى قريباً منه.",
  "Register your clinic →": "سجّل عيادتك →",

  // ── LandingPage — doctor card ────────────────────────────────────────────────
  "New": "جديد",
  "General": "عام",
  "Contact for fee": "تواصل للاستفسار عن الرسوم",
  "View Profile →": "عرض الملف الشخصي →",

  // ── LandingPage — How It Works ───────────────────────────────────────────────
  "Simple & Transparent": "بسيط وشفاف",
  "How It Works": "كيف يعمل",
  "Three easy steps to skip the waiting room forever.": "ثلاث خطوات بسيطة للتخلص من غرفة الانتظار إلى الأبد.",
  "Search & Find": "ابحث واكتشف",
  "Browse top-rated specialists by specialty, area, and real-time availability — all in one place.":
    "تصفح أفضل المتخصصين حسب التخصص والمنطقة والتوفر الفوري — كل شيء في مكان واحد.",
  "Book Online": "احجز عبر الإنترنت",
  "Select a session that fits your schedule and confirm your spot in seconds. No phone calls needed.":
    "اختر جلسة تناسب جدولك وأكد مكانك في ثوانٍ. لا حاجة لأي مكالمات هاتفية.",
  "Track Your Queue": "تابع طابورك",
  "Get a live digital ticket and watch your position update in real-time from anywhere.":
    "احصل على تذكرة رقمية حية وشاهد موقعك يتحدث في الوقت الفعلي من أي مكان.",

  // ── LandingPage — CTA ────────────────────────────────────────────────────────
  "Ready to skip the wait?": "هل أنت مستعد للتخلص من الانتظار؟",
  "Join thousands of patients who book smarter every day.": "انضم إلى آلاف المرضى الذين يحجزون بذكاء كل يوم.",
  "Find Your Doctor →": "ابحث عن طبيبك →",

  // ── LoginPage ────────────────────────────────────────────────────────────────
  "Welcome back": "مرحباً بعودتك",
  "Sign in to your account to continue": "سجّل دخولك إلى حسابك للمتابعة",
  "Sign in with phone or email": "سجّل الدخول برقم الهاتف أو البريد الإلكتروني",
  "Use the phone number or email you registered with, along with your password.":
    "استخدم رقم هاتفك أو بريدك الإلكتروني المسجل مع كلمة مرورك.",
  "Email Address or Phone number*": "البريد الإلكتروني أو رقم الهاتف *",
  "Password *": "كلمة المرور *",
  "Signing in…": "جارٍ تسجيل الدخول…",
  "Sign In →": "تسجيل الدخول →",
  "Forgot your password?": "نسيت كلمة مرورك؟",
  "Don't have an account?": "ليس لديك حساب؟",
  "Create one →": "أنشئ حساباً →",
  "Phone number is required.": "رقم الهاتف مطلوب.",
  "Password is required.": "كلمة المرور مطلوبة.",

  // ── SignupPage ───────────────────────────────────────────────────────────────
  "Create Account": "إنشاء حساب",
  "Patient Sign Up": "تسجيل مريض",
  "Doctor Sign Up": "تسجيل طبيب",
  "How do you work?": "كيف تعمل؟",
  "Set Up Your Clinic": "إعداد عيادتك",
  "Find Your Clinic": "ابحث عن عيادتك",
  "Request Sent!": "تم إرسال الطلب!",
  "Join thousands using Waitless": "انضم إلى آلاف مستخدمي Waitless",
  "Book and track your appointments": "احجز وتابع مواعيدك",
  "Tell us about yourself": "أخبرنا عنك",
  "Choose the path that fits you": "اختر المسار المناسب لك",
  "You'll manage the clinic as admin and doctor": "ستدير العيادة كمسؤول وطبيب",
  "Request to join an existing clinic": "طلب الانضمام إلى عيادة موجودة",
  "Waiting for clinic admin approval": "بانتظار موافقة مدير العيادة",
  "Who are you signing up as?": "من أنت في هذا التسجيل؟",
  "I'm a Patient": "أنا مريض",
  "Book appointments and track your queue": "احجز مواعيد وتابع طابورك",
  "I'm a Doctor": "أنا طبيب",
  "Manage your queue and clinic operations": "أدر طابورك وعمليات العيادة",
  "Setting up a clinic?": "هل تقوم بإعداد عيادة؟",
  "Register your organization →": "سجّل مؤسستك →",
  "Already have an account?": "لديك حساب بالفعل؟",
  "Sign in →": "تسجيل الدخول →",
  "Full Name *": "الاسم الكامل *",
  "Email Address *": "البريد الإلكتروني *",
  "Phone Number *": "رقم الهاتف *",
  "Date of Birth *": "تاريخ الميلاد *",
  "Min. 8 chars + 1 number": "8 أحرف على الأقل + رقم واحد",
  "Creating…": "جارٍ الإنشاء…",
  "Create Account →": "إنشاء حساب →",
  "Specialty *": "التخصص *",
  "Select or type your specialty…": "اختر أو اكتب تخصصك…",
  "Medical License Number": "رقم الترخيص الطبي",
  "Continue →": "متابعة →",
  "← Back": "رجوع",
  "Your Info": "معلوماتك",
  "Clinic Type": "نوع العيادة",
  "Clinic Setup": "إعداد العيادة",
  "Find Clinic": "العثور على العيادة",
  "Do you run your own clinic or work at an existing one?":
    "هل تدير عيادتك الخاصة أم تعمل في عيادة موجودة؟",
  "I own my clinic": "أملك عيادتي الخاصة",
  "Create a new clinic on Waitless — you'll be the admin and a doctor":
    "أنشئ عيادة جديدة على Waitless — ستكون المسؤول والطبيب",
  "I work at an existing clinic": "أعمل في عيادة موجودة",
  "Search for your clinic and request to join — the admin will approve you":
    "ابحث عن عيادتك واطلب الانضمام — سيوافق عليك المسؤول",
  "Clinic Name *": "اسم العيادة *",
  "Type": "النوع",
  "Country": "الدولة",
  "List on Marketplace": "إدراج في السوق",
  "Patients can discover and book your doctors online": "يمكن للمرضى اكتشاف أطبائك وحجز مواعيد عبر الإنترنت",
  "Create Clinic →": "إنشاء عيادة →",
  "Search for your clinic *": "ابحث عن عيادتك *",
  "Type clinic name…": "اكتب اسم العيادة…",
  "Searching…": "جارٍ البحث…",
  "No clinics found. Try a different name.": "لم يتم العثور على عيادات. جرب اسماً مختلفاً.",
  "Change": "تغيير",
  "Message to Admin (optional)": "رسالة للمسؤول (اختياري)",
  "Introduce yourself briefly…": "قدّم نفسك بإيجاز…",
  "Sending…": "جارٍ الإرسال…",
  "Send Join Request →": "إرسال طلب الانضمام →",
  "Request Submitted!": "تم تقديم الطلب!",
  "has been sent.": "تم إرسالها.",
  "The clinic admin will review and approve your request. You'll be able to log in once approved.":
    "سيراجع مسؤول العيادة طلبك ويوافق عليه. ستتمكن من تسجيل الدخول بمجرد الموافقة.",
  "While you wait": "في انتظار الموافقة",
  "• Log in any time to check your request status": "• سجّل الدخول في أي وقت للتحقق من حالة طلبك",
  "• Watch for an email invitation from the clinic": "• راقب دعوة البريد الإلكتروني من العيادة",
  "• Once approved, you'll get full doctor access": "• بمجرد الموافقة، ستحصل على وصول كامل كطبيب",
  "Go to Sign In →": "الانتقال لتسجيل الدخول →",

  // ── OrgLandingPage ───────────────────────────────────────────────────────────
  "For Clinics & Healthcare Organizations": "للعيادات والمنظمات الصحية",
  "Modern Queue Management": "إدارة الطوابير الحديثة",
  "for Your Clinic": "لعيادتك",
  "Replace paper lists and phone calls with a digital queue system. Patients track their position live. Doctors control the flow. Your clinic runs smoother — starting today.":
    "استبدل القوائم الورقية والمكالمات الهاتفية بنظام طوابير رقمي. يتابع المرضى موقعهم مباشرة. يتحكم الأطباء في التدفق. تعمل عيادتك بشكل أكثر سلاسة — ابتداءً من اليوم.",
  "Go to Admin Dashboard →": "الانتقال إلى لوحة تحكم المسؤول →",
  "Get Started Free →": "ابدأ مجاناً →",
  "Browse as Patient": "تصفح كمريض",
  "✓ No setup fee": "✓ بدون رسوم إعداد",
  "✓ Free starter plan": "✓ خطة مبدئية مجانية",
  "✓ Live in 10 minutes": "✓ مباشر خلال 10 دقائق",
  "✓ No code required": "✓ لا يلزم برمجة",
  "Patients managed": "مريض تمت إدارته",
  "Doctors onboarded": "طبيب تم تأهيله",
  "Avg queue update interval": "متوسط فترة تحديث الطابور",
  "Queue accuracy": "دقة الطابور",
  "Everything your clinic needs": "كل ما تحتاجه عيادتك",
  "Built specifically for Egyptian healthcare providers. No generic software.":
    "مبني خصيصاً لمقدمي الرعاية الصحية المصريين. لا برامج عامة.",
  "Smart Queue Management": "إدارة الطوابير الذكية",
  "Real-time digital queue with live position tracking for patients. Doctors control the flow — call, hold, skip, or complete with one tap.":
    "طابور رقمي في الوقت الفعلي مع تتبع مباشر للموقع للمرضى. يتحكم الأطباء في التدفق — استدعاء أو إيقاف أو تخطي أو إكمال بنقرة واحدة.",
  "Automated Scheduling": "الجدولة التلقائية",
  "Define weekly patterns once. Waitless auto-generates daily sessions, handles exceptions, and propagates changes to all upcoming dates.":
    "حدد أنماطاً أسبوعية مرة واحدة. يولّد Waitless الجلسات اليومية تلقائياً، ويتعامل مع الاستثناءات، وينشر التغييرات على جميع التواريخ القادمة.",
  "Multi-Branch Support": "دعم تعدد الفروع",
  "Manage multiple clinic locations under one organization. Each branch has its own staff, schedules, and session capacity.":
    "أدر مواقع عيادات متعددة تحت مؤسسة واحدة. لكل فرع موظفوه وجداوله وقدرته الاستيعابية الخاصة.",
  "Staff & Role Management": "إدارة الموظفين والأدوار",
  "Invite doctors and receptionists, assign roles, set permissions, and manage the full team from a single admin dashboard.":
    "ادعُ الأطباء وموظفي الاستقبال وحدد الأدوار وضبط الأذونات وأدر الفريق بالكامل من لوحة تحكم مسؤول واحدة.",
  "Revenue & Wallets": "الإيرادات والمحافظ",
  "Automatic commission splits at session completion. Track earnings per doctor, branch revenue, and organization wallet balance.":
    "تقسيم تلقائي للعمولات عند اكتمال الجلسة. تتبع أرباح كل طبيب وإيرادات الفرع ورصيد محفظة المؤسسة.",
  "Marketplace Visibility": "الظهور في السوق",
  "Get discovered by patients searching by specialty and area. Your clinic appears in the Waitless marketplace with live session availability.":
    "اكتشفك المرضى الذين يبحثون حسب التخصص والمنطقة. تظهر عيادتك في سوق Waitless مع توفر الجلسات المباشرة.",
  "3 steps": "3 خطوات",
  "Create Your Organization": "أنشئ مؤسستك",
  "Sign up, set up your clinic profile, and add your branches in minutes.":
    "سجّل واعدّ ملف عيادتك وأضف فروعك في دقائق.",
  "Add Staff & Schedules": "أضف الموظفين والجداول",
  "Invite doctors and receptionists. Define weekly schedule patterns — Waitless generates daily sessions automatically.":
    "ادعُ الأطباء وموظفي الاستقبال. حدد أنماط الجدول الأسبوعي — يولّد Waitless الجلسات اليومية تلقائياً.",
  "Go Live": "ابدأ الآن",
  "Patients book online or walk in. The queue runs itself — your staff just manages exceptions.":
    "يحجز المرضى عبر الإنترنت أو يمشون مباشرة. يُدار الطابور تلقائياً — موظفوك يتعاملون فقط مع الاستثناءات.",
  "Simple, transparent pricing": "أسعار بسيطة وشفافة",
  "Start free. Upgrade when you grow.": "ابدأ مجاناً. رقّ عند نموك.",
  "Most Popular": "الأكثر شعبية",
  "Starter": "المبتدئ",
  "Free": "مجاني",
  "Clinic": "عيادة",
  "Enterprise": "مؤسسة",
  "Get Started Free": "ابدأ مجاناً",
  "Start Free Trial": "ابدأ التجربة المجانية",
  "Contact Sales": "تواصل مع فريق المبيعات",
  "Manage Plan →": "إدارة الخطة →",
  "You're logged in": "أنت مسجل الدخول",
  "Go to your Admin Dashboard": "انتقل إلى لوحة تحكم المسؤول",
  "Manage your clinic, view your queue, update schedules, and track revenue — all in one place.":
    "أدر عيادتك وشاهد طابورك وحدّث الجداول وتتبع الإيرادات — كل شيء في مكان واحد.",
  "Open Dashboard →": "فتح لوحة التحكم →",
  "View Billing Plans": "عرض خطط الفوترة",
  "Ready to modernize your clinic?": "هل أنت مستعد لتحديث عيادتك؟",
  "Join hundreds of clinics already saving time with Waitless.":
    "انضم إلى مئات العيادات التي توفر وقتها مع Waitless.",
  "Create Your Clinic Account →": "إنشاء حساب عيادتك →",
  "Free to start · No credit card required": "مجاني للبدء · لا بطاقة ائتمان مطلوبة",

  // ── Plan feature bullets ─────────────────────────────────────────────────────
  "1 branch": "فرع واحد",
  "Up to 5 doctors": "حتى 5 أطباء",
  "2 receptionists": "موظفا استقبال",
  "Basic queue management": "إدارة الطابور الأساسية",
  "Email support": "دعم البريد الإلكتروني",
  "Up to 3 branches": "حتى 3 فروع",
  "Up to 15 doctors": "حتى 15 طبيباً",
  "10 receptionists": "10 موظفي استقبال",
  "Marketplace listing": "إدراج في السوق",
  "WhatsApp notifications": "إشعارات واتساب",
  "Wallet & revenue reports": "تقارير المحفظة والإيرادات",
  "Priority support": "دعم ذو أولوية",
  "Unlimited branches": "فروع غير محدودة",
  "Unlimited doctors": "أطباء غير محدودين",
  "All Clinic features": "جميع ميزات العيادة",
  "Custom integrations": "تكاملات مخصصة",
  "Dedicated account manager": "مدير حساب مخصص",
  "SLA guarantee": "ضمان مستوى الخدمة",
};

// ── Context ────────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  // Inject dir + lang on the root <html> element whenever locale changes.
  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  }, [locale]);

  function toggleLocale() {
    setLocale((prev) => (prev === "en" ? "ar" : "en"));
  }

  function t(text: string): string {
    if (locale === "en") return text;
    // Brand name exception: never translate the bare brand name.
    if (text.trim().toLowerCase() === "waitless") return text;
    return AR[text] ?? text;
  }

  return (
    <LanguageContext.Provider value={{ locale, toggleLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}
