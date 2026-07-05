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

  // ── Doctor Dashboard — header & nav ─────────────────────────────────────────
  "Welcome, Dr.": "مرحباً، د.",
  "+ Admin": "+ مسؤول",
  "Physician": "طبيب",
  "Clinic Portal": "بوابة العيادة",
  "No clinic assigned": "لم يتم تحديد عيادة",
  "Admin View →": "عرض المسؤول →",
  "Dashboard": "لوحة التحكم",
  "← Dashboard": "← لوحة التحكم",
  "One quick step": "خطوة سريعة",
  "We need your specialty to complete your profile.": "نحتاج إلى تخصصك لإكمال ملفك الشخصي.",
  "Your account doesn't have a specialty listed yet. This is required to appear correctly in the system.":
    "حسابك لا يحتوي على تخصص بعد. هذا مطلوب للظهور بشكل صحيح في النظام.",
  "Your Specialty *": "تخصصك *",
  "Please enter your specialty.": "يرجى إدخال تخصصك.",
  "Save & Continue →": "حفظ ومتابعة →",

  // ── Doctor Dashboard — home cards ─────────────────────────────────────────────
  "Today's Queue": "طابور اليوم",
  "View and serve patients in your active session": "عرض وخدمة المرضى في جلستك النشطة",
  "Manage Queue": "إدارة الطابور",
  "Call, skip, hold, and complete queue items manually": "استدعاء وتخطي وإيقاف وإكمال عناصر الطابور يدوياً",
  "Monthly schedule view with booked sessions at a glance": "عرض الجدول الشهري مع الجلسات المحجوزة",
  "My Sessions": "جلساتي",
  "Upcoming and past sessions with patient appointments": "الجلسات القادمة والسابقة مع مواعيد المرضى",
  "My Wallet": "محفظتي",
  "Track your earnings, commissions, and top-up history": "تتبع أرباحك وعمولاتك وسجل الشحن",
  "My Profile": "ملفي الشخصي",
  "Update your bio, specialties, and account settings": "تحديث سيرتك وتخصصاتك وإعدادات الحساب",
  "Admin Panel": "لوحة الإدارة",
  "Manage your clinic, staff, and schedules": "أدر عيادتك وموظفيك وجداولك",
  "Switch to Admin →": "التحويل إلى المسؤول →",
  "Open →": "فتح →",

  // ── Doctor Dashboard — Queue tab ─────────────────────────────────────────────
  "No active session today": "لا توجد جلسة نشطة اليوم",
  "Ask the receptionist to start your session or check the Sessions tab.":
    "اطلب من موظف الاستقبال بدء جلستك أو تحقق من علامة تبويب الجلسات.",
  "Start a session first (via the Sessions tab or ask reception).":
    "ابدأ جلسة أولاً (عبر علامة الجلسات أو اسأل الاستقبال).",
  "Take a Break": "أخذ استراحة",
  "☕ Take a Break": "☕ أخذ استراحة",
  "Queue will pause and patients will be notified": "سيتوقف الطابور وسيتم إخطار المرضى",
  "Break duration": "مدة الاستراحة",
  "Cancel": "إلغاء",
  "Start Break": "بدء الاستراحة",
  "Starting…": "جارٍ البدء…",
  "You are on a break": "أنت في استراحة",
  "Patients have been notified": "تم إخطار المرضى",
  "Resume Queue": "استئناف الطابور",
  "Resuming…": "جارٍ الاستئناف…",
  "Session not yet started — break unavailable": "الجلسة لم تبدأ بعد — الاستراحة غير متاحة",
  "Now Serving": "يُخدَم الآن",
  "Start Consultation →": "بدء الاستشارة →",
  "Mark Complete ✓": "تحديد كمكتمل ✓",
  "Call Next Patient →": "استدعاء المريض التالي →",
  "Queue is empty": "الطابور فارغ",
  "Total Patients": "إجمالي المرضى",
  "Waiting": "في الانتظار",
  "Completed": "مكتمل",

  // ── Doctor Dashboard — Queue row statuses ────────────────────────────────────
  "Called ↑": "تم الاستدعاء ↑",
  "In Progress": "جارٍ",
  "Done ✓": "تم ✓",
  "No-Show": "لم يحضر",
  "Skipped ↩": "تم التخطي ↩",
  "Cancelled": "ملغى",
  "Skip": "تخطي",

  // ── Doctor Dashboard — Sessions tab ──────────────────────────────────────────
  "Today's sessions": "جلسات اليوم",
  "↻ Refresh": "↻ تحديث",
  "No sessions scheduled today": "لا توجد جلسات مجدولة اليوم",
  "Contact your clinic administrator to schedule sessions.": "تواصل مع مسؤول العيادة لجدولة الجلسات.",
  "Start Session": "بدء الجلسة",
  "End Session": "إنهاء الجلسة",
  "Ending…": "جارٍ الإنهاء…",
  "Submit Excuse": "تقديم عذر",
  "Failed to end session. Please try again.": "فشل إنهاء الجلسة. حاول مرة أخرى.",
  "Failed to start session. Please try again.": "فشل بدء الجلسة. حاول مرة أخرى.",
  "Start Session": "بدء الجلسة",
  "Yes, Start Session": "نعم، ابدأ الجلسة",
  "Your clinic has receptionists. Is the receptionist absent today? You'll be starting this session yourself.":
    "عيادتك لديها موظفو استقبال. هل موظف الاستقبال غائب اليوم؟ ستبدأ هذه الجلسة بنفسك.",
  "Submit Late-Start Excuse": "تقديم عذر تأخر البدء",
  "Explain why your session started late": "اشرح سبب تأخر بدء جلستك",
  "Describe the reason (e.g. traffic, emergency, technical issue)…":
    "اشرح السبب (مثلاً: زحام مرور، حالة طارئة، مشكلة تقنية)…",
  "Submit": "إرسال",
  "Submitting…": "جارٍ الإرسال…",
  "Failed to submit excuse. Please try again.": "فشل تقديم العذر. حاول مرة أخرى.",
  "Please enter a reason.": "يرجى إدخال سبب.",
  "booked": "محجوز",
  "scheduled": "مجدول",
  "active": "نشط",
  "ended": "منتهٍ",
  "Excuse:": "العذر:",
  "pending": "قيد المراجعة",
  "approved": "موافق عليه",
  "denied": "مرفوض",

  // ── Doctor Dashboard — Calendar tab ──────────────────────────────────────────
  "No sessions on this day.": "لا توجد جلسات في هذا اليوم.",
  "session": "جلسة",
  "sessions": "جلسات",

  // ── Doctor Dashboard — Manage Queue tab ─────────────────────────────────────
  "Receptionist mode": "وضع الاستقبال",
  "Use this tab when operating without reception staff.": "استخدم هذا التبويب عند العمل بدون موظف استقبال.",
  "No patients waiting": "لا يوجد مرضى في الانتظار",
  "Called & Held": "تم الاستدعاء والإيقاف",
  "Hold": "إيقاف",
  "Re-insert": "إعادة الإدراج",
  "Called": "تم الاستدعاء",
  "Held": "موقوف",
  "Add Walk-In Patient": "إضافة مريض مباشر",
  "Patient full name": "الاسم الكامل للمريض",
  "Adding…": "جارٍ الإضافة…",
  "Add to Queue": "إضافة إلى الطابور",
  "Call Next →": "استدعاء التالي →",

  // ── Doctor Dashboard — Profile tab ───────────────────────────────────────────
  "Profile not found — membership may still be loading.": "الملف الشخصي غير موجود.",
  "Bio": "السيرة الذاتية",
  "Specialties": "التخصصات",
  "Website URL": "رابط الموقع الإلكتروني",
  "Avatar URL": "رابط الصورة",
  "Languages Spoken": "اللغات المتحدث بها",
  "Years of Experience": "سنوات الخبرة",
  "Accepted Insurance": "التأمين المقبول",
  "Save Profile": "حفظ الملف الشخصي",
  "Saving…": "جارٍ الحفظ…",
  "Profile updated successfully.": "تم تحديث الملف الشخصي بنجاح.",
  "Failed to save. Please try again.": "فشل الحفظ. حاول مرة أخرى.",
  "My Weekly Schedule": "جدولي الأسبوعي",
  "Managed by your clinic administrator.": "يُدار بواسطة مسؤول عيادتك.",
  "Earnings per Consultation": "الأرباح لكل استشارة",
  "Platform (15%)": "المنصة (15٪)",
  "Clinic (21%)": "العيادة (21٪)",
  "No specialty listed": "لم يُدرج تخصص",
  "years experience": "سنوات خبرة",
  "Speaks:": "يتحدث:",
  "min avg. consultation": "دقيقة متوسط الاستشارة",
  "EGP / visit": "ج.م / زيارة",
  "EGP": "ج.م",

  // ── Patient Dashboard ────────────────────────────────────────────────────────
  "Your account": "حسابك",
  "Quick Actions": "إجراءات سريعة",
  "Active Bookings": "الحجوزات النشطة",
  "Past History": "السجل السابق",
  "Active booking": "حجز نشط",
  "Queue #": "رقم الطابور",
  "Go to Live Ticket →": "الانتقال إلى التذكرة الحية →",
  "Cancel Appointment": "إلغاء الموعد",
  "50 EGP cancellation fee applies": "تطبق رسوم إلغاء 50 ج.م",
  "Cancellations within 1 hour of the session start incur a 50 EGP penalty deducted from your wallet. Make sure you have sufficient balance.":
    "الإلغاءات خلال ساعة من بدء الجلسة تستوجب غرامة 50 ج.م مخصومة من محفظتك. تأكد من وجود رصيد كافٍ.",
  "I understand that 50 EGP will be deducted from my wallet.": "أفهم أن 50 ج.م سيُخصم من محفظتي.",
  "Are you sure you want to cancel this appointment? This action cannot be undone.":
    "هل أنت متأكد من إلغاء هذا الموعد؟ لا يمكن التراجع عن هذا الإجراء.",
  "Failed to cancel. Please try again.": "فشل الإلغاء. حاول مرة أخرى.",
  "Keep Booking": "الاحتفاظ بالحجز",
  "Yes, Cancel": "نعم، إلغاء",
  "Cancelling…": "جارٍ الإلغاء…",
  "No active bookings yet": "لا توجد حجوزات نشطة بعد",
  "Book a doctor to see your active queue ticket here.": "احجز طبيباً لرؤية تذكرة طابورك النشطة هنا.",
  "Book a Doctor →": "احجز طبيباً →",
  "No past appointments yet.": "لا توجد مواعيد سابقة بعد.",
  "Waiting for session to start": "في انتظار بدء الجلسة",
  "Your position": "موقعك",
  "Est. wait": "وقت الانتظار المتوقع",
  "View ticket →": "عرض التذكرة →",
  "Cancel booking": "إلغاء الحجز",
  "Profile": "الملف الشخصي",
  "Name": "الاسم",
  "Email": "البريد الإلكتروني",
  "Phone": "الهاتف",
  "Date of Birth": "تاريخ الميلاد",
  "Edit Profile": "تعديل الملف الشخصي",
  "Save Changes": "حفظ التغييرات",
  "Saving": "جارٍ الحفظ",

  // ── Admin Dashboard ──────────────────────────────────────────────────────────
  "Loading…": "جارٍ التحميل…",
  "Your Organization": "مؤسستك",
  "My Queue": "طابوري",
  "Overview": "نظرة عامة",
  "Branches": "الفروع",
  "Staff": "الموظفون",
  "Join Requests": "طلبات الانضمام",
  "Schedules": "الجداول",
  "Sessions": "الجلسات",
  "Settings": "الإعدادات",
  "Billing": "الفواتير",
  "Org stats, marketplace visibility and trial status": "إحصاءات المؤسسة والظهور في السوق",
  "Manage clinic locations and contact details": "إدارة مواقع العيادات وتفاصيل الاتصال",
  "Invite, edit roles, and manage team members": "دعوة وتعديل الأدوار وإدارة أعضاء الفريق",
  "Review and approve doctors requesting to join": "مراجعة والموافقة على طلبات الأطباء للانضمام",
  "Set weekly doctor schedules, auto-generate sessions": "تعيين جداول الأطباء الأسبوعية، إنشاء الجلسات تلقائياً",
  "View and cap daily patient sessions per branch": "عرض وتحديد الجلسات اليومية للمرضى لكل فرع",
  "Edit organization name and branch commission rates": "تعديل اسم المؤسسة ومعدلات عمولة الفروع",
  "Subscription plans and feature access tiers": "خطط الاشتراك ومستويات الوصول للميزات",
  "Automate appointment reminders via WhatsApp": "أتمتة تذكيرات المواعيد عبر واتساب",
  "Doctor View →": "عرض الطبيب →",

  // ── Receptionist Dashboard ───────────────────────────────────────────────────
  "Reception Desk": "طاولة الاستقبال",
  "Today's Sessions": "جلسات اليوم",
  "Walk-In Booking": "حجز مباشر",
  "Patient Check-In": "تسجيل دخول المريض",
  "No sessions today": "لا توجد جلسات اليوم",
  "View all active doctor sessions, expand to see patient queue and manage appointments":
    "عرض جميع جلسات الأطباء النشطة، توسيع لرؤية طابور المرضى وإدارة المواعيد",
  "Register a walk-in patient into an active session without a prior appointment":
    "تسجيل مريض مباشر في جلسة نشطة بدون موعد مسبق",
  "Look up an existing appointment by phone number to confirm arrival at the clinic":
    "البحث عن موعد موجود برقم الهاتف لتأكيد الوصول إلى العيادة",
  "Confirm before starting without reception": "تأكيد قبل البدء بدون الاستقبال",

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

  // ── Insurance / Doctor Profile ───────────────────────────────────────────────
  "No insurances supported": "لا توجد تأمينات مدعومة",
  "Accepted Insurance": "التأمين المقبول",
  "No ratings yet": "لا توجد تقييمات بعد",
  "Positive Reviews": "التقييمات الإيجابية",
  "Patient Rating": "تقييم المريض",
  "Years Experience": "سنوات الخبرة",
  "Reviews": "التقييمات",
  "Languages": "اللغات",

  // ── Live Ticket ───────────────────────────────────────────────────────────────
  "Live queue · syncing in real-time": "الطابور المباشر · يتزامن لحظة بلحظة",
  "Appointment confirmed · awaiting session day": "تم تأكيد الموعد · بانتظار يوم الجلسة",
  "Doctor is on a short break": "الطبيب في استراحة قصيرة",
  "Queue will resume shortly. Your estimated wait has been updated.": "سيستأنف الطابور قريبًا. تم تحديث وقت الانتظار المتوقع.",
  "Doctor is running behind": "الطبيب متأخر",
  "estimated extra delay:": "تأخير إضافي متوقع:",
  "min": "دقيقة",
  "An emergency case was inserted ahead of you": "تم إدراج حالة طارئة قبلك",
  "You're next!": "دورك الآن!",
  "Almost your turn —": "دورك قريب —",
  "patient ahead": "مريض قبلك",
  "patients ahead": "مرضى قبلك",
  "Please make your way to the clinic now.": "يرجى التوجه إلى العيادة الآن.",
  "Live": "مباشر",
  "Paid ✓": "مدفوع ✓",
  "Payment Failed": "فشل الدفع",
  "Pay at Clinic": "الدفع في العيادة",
  "Note:": "ملاحظة:",
  "Cancel My Booking": "إلغاء حجزي",
  "Cancelling…": "جارٍ الإلغاء…",
  "Cancel your appointment? This cannot be undone.": "هل تريد إلغاء موعدك؟ لا يمكن التراجع عن هذا الإجراء.",
  "Keep this page open to track your position.": "أبقِ هذه الصفحة مفتوحة لتتبع موقعك في الطابور.",
  "View in My Dashboard →": "عرض في لوحتي →",
  "Session Closed": "انتهت الجلسة",
  "This session ended at": "انتهت هذه الجلسة في الساعة",
  "If you were not seen, please contact the clinic to reschedule.": "إذا لم تتم رؤيتك، يرجى التواصل مع العيادة لإعادة الجدولة.",
  "No further queue updates will be made for this session.": "لن يكون هناك أي تحديثات أخرى للطابور في هذه الجلسة.",
  "Session starts in": "تبدأ الجلسة خلال",
  "Your session is scheduled to begin at": "موعد بدء جلستك في الساعة",
  "Your queue position and wait time will appear here once the session begins.": "ستظهر هنا موقعك في الطابور ووقت الانتظار بمجرد بدء الجلسة.",
  "Arrive 10 minutes before your scheduled session.": "احضر قبل 10 دقائق من موعد جلستك.",
  "Today!": "اليوم!",
  "Tomorrow!": "غدًا!",
  "days to go": "أيام متبقية",
  "Your appointment is scheduled for": "موعدك مقرر في",
  "Return on the day of your appointment to track your live queue position.": "عُد في يوم موعدك لتتبع موقعك في الطابور المباشر.",
  "Your number:": "رقمك:",
  "Your position in queue": "موقعك في الطابور",
  "Currently serving": "يتم الآن خدمة",
  "Estimated wait": "الانتظار المتوقع",
  "Avg consultation": "متوسط الاستشارة",
  "Best time to arrive at the clinic": "أفضل وقت للحضور إلى العيادة",
  "It's your turn!": "حان دورك!",
  "Please proceed to reception within": "يرجى التوجه إلى الاستقبال خلال",
  "5 minutes": "5 دقائق",
  "or your spot may be given to the next patient.": "وإلا قد يُعطى دورك للمريض التالي.",
  "Show this screen at the reception desk": "أرِ هذه الشاشة لموظف الاستقبال",
  "Reception staff will note your details": "سيسجل موظف الاستقبال بياناتك",
  "No active ticket": "لا توجد تذكرة نشطة",
  "You don't have an active booking. Find a doctor and book an appointment to receive your live queue ticket.": "ليس لديك حجز نشط. ابحث عن طبيب واحجز موعدًا للحصول على تذكرة الطابور المباشر.",
  "Find a Doctor": "ابحث عن طبيب",
  "Rate Your Consultation": "قيّم استشارتك",
  "How was your experience with": "كيف كانت تجربتك مع",
  "Thank you!": "شكرًا لك!",
  "Your feedback helps improve care.": "تساعد ملاحظاتك في تحسين الرعاية.",
  "Submit Rating": "إرسال التقييم",
  "Sending…": "جارٍ الإرسال…",

  // ── Specialties ──────────────────────────────────────────────────────────────
  "All Specialties": "جميع التخصصات",
  "Cardiology": "أمراض القلب",
  "Dermatology": "أمراض الجلد",
  "Pediatrics": "طب الأطفال",
  "Orthopedics": "جراحة العظام",
  "Internal Medicine": "الطب الباطني",
  "Neurology": "الأعصاب",
  "Ophthalmology": "طب العيون",
  "ENT": "أنف وأذن وحنجرة",
  "Obstetrics & Gynecology": "النساء والتوليد",
  "Psychiatry": "الطب النفسي",
  "Dentistry": "طب الأسنان",
  "Urology": "المسالك البولية",
  "Endocrinology": "الغدد الصماء",
  "Rheumatology": "الروماتيزم",
  "Oncology": "الأورام",
  "General Surgery": "الجراحة العامة",
  "Radiology": "الأشعة",
  "Physical Therapy": "العلاج الطبيعي",

  // ── Calendar status labels ────────────────────────────────────────────────────
  "Waiting": "في الانتظار",
  "Called": "تم الاستدعاء",
  "In Progress": "قيد التقدم",
  "Done": "منتهي",
  "No-Show": "لم يحضر",
  "Skipped": "تم التخطي",
  "No sessions on this day.": "لا توجد جلسات في هذا اليوم.",

  // ── Calendar day & month names ────────────────────────────────────────────────
  "Sun": "الأحد",
  "Mon": "الاثنين",
  "Tue": "الثلاثاء",
  "Wed": "الأربعاء",
  "Thu": "الخميس",
  "Fri": "الجمعة",
  "Sat": "السبت",
  "Sunday": "الأحد",
  "Monday": "الاثنين",
  "Tuesday": "الثلاثاء",
  "Wednesday": "الأربعاء",
  "Thursday": "الخميس",
  "Friday": "الجمعة",
  "Saturday": "السبت",
  "January": "يناير",
  "February": "فبراير",
  "March": "مارس",
  "April": "أبريل",
  "May": "مايو",
  "June": "يونيو",
  "July": "يوليو",
  "August": "أغسطس",
  "September": "سبتمبر",
  "October": "أكتوبر",
  "November": "نوفمبر",
  "December": "ديسمبر",
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
