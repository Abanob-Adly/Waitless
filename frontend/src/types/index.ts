// ── Canonical type definitions for Waitless ──────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────────────────

export type PatientProfile = {
  id: string;
  name: string;
  phone: string;
  birthdate: string; // "YYYY-MM-DD"
  email?: string;
  password: string;
};

// Backward-compat alias so existing code that imports `Patient` keeps working
export type Patient = PatientProfile;

export type DoctorAccount = {
  id: string;
  name: string;
  phone: string;
  email: string;
  specialty: string;
  licenseNumber: string;
  password: string;
  orgId: string;
};

export type AdminAccount = {
  id: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  orgId: string;
};

export type ReceptionistAccount = {
  id: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  orgId: string;
  branchId: string;
};

export type StaffAccount = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type AuthRole = "patient" | "doctor" | "admin" | "receptionist" | "staff";

export type AuthUser =
  | { role: "patient"; profile: PatientProfile }
  | { role: "doctor"; profile: DoctorAccount }
  | { role: "admin"; profile: AdminAccount }
  | { role: "receptionist"; profile: ReceptionistAccount }
  | { role: "staff"; profile: StaffAccount } // Worker with no active membership yet
  | null;

// ── Signup payloads ───────────────────────────────────────────────────────────

export type PatientSignupPayload = {
  name: string;
  phone: string;
  birthdate: string;
  password: string;
  email?: string;
};

export type DoctorSignupPayload = {
  name: string;
  phone: string;
  specialty: string;
  licenseNumber: string;
  password: string;
};

export type OrgOnboardingPayload = {
  adminName: string;
  adminPhone: string;
  adminEmail: string;
  adminPassword: string;
  orgName: string;
  orgType: OrgType;
  country: string;
  timezone: string;
  isPublic: boolean;
};

export type InviteAcceptPayload = {
  token: string;
  name: string;
  phone: string;
  password: string;
};

// ── Doctor listing (marketplace) ──────────────────────────────────────────────

export type ClinicLocation = {
  id: string;
  name: string;
  address: string;
  phone: string;
};

export type Doctor = {
  id: string;
  initials: string;
  name: string;
  title: string;
  specialty: string;
  organization: string;
  bio: string;
  rating: number;
  reviewCount: number;
  fee: number;
  area: string;
  experienceYears: number;
  languages: string[];
  verified: boolean;
  availableLabel: string;
  clinics: ClinicLocation[];
  insurance: string[];
  avatarUrl?: string;
};

export type Session = {
  id: string;
  doctorId: string;
  clinicId: string;
  clinicName: string;
  date: string;
  startTime: string;
  endTime: string;
  availableSlots: number;
  avgConsultationMin: number;
  fee?: number;
  status: "scheduled" | "active" | "closed";
  queueToken: string;
  scheduleId?: string;
};

// ── Booking ───────────────────────────────────────────────────────────────────

export type ActiveBooking = {
  id: string;
  doctor: Doctor;
  session: Session;
  queueNumber: number;
  paymentMethod: "card" | "vodafone" | "clinic" | "wallet";
  paymentStatus: "success" | "failed" | "pending";
  transactionId?: string;
  patientNotes?: string;
  last4?: string;
  /** accessToken returned by the backend — used for public queue tracking */
  accessToken?: string;
};

export type HistoryRecord = {
  id: string;
  doctorName: string;
  doctorInitials: string;
  specialty: string;
  date: string;
  fee: number;
  status: "completed" | "cancelled";
};

export type BookingIntent = {
  doctor: Doctor;
  session: Session;
};

// ── API payloads ──────────────────────────────────────────────────────────────

export type BookingPayload = {
  doctorId: string;
  sessionId: string;
  patientName: string;
  patientPhone: string;
  avgConsultationMin: number;
};

export type PaymentPayload = {
  method: "card" | "vodafone" | "clinic";
  appointmentId: string;
  amount: number;
  last4?: string;
};

export type PaymentRecord = {
  transactionId: string;
  appointmentId: string;
  amount: number;
  method: "card" | "vodafone" | "clinic";
  status: "success" | "failed";
  timestamp: string;
  last4?: string;
};

// ── Organization domain ───────────────────────────────────────────────────────

export type OrgType = "clinic" | "hospital" | "polyclinic";

export type Organization = {
  id: string;
  name: string;
  type: OrgType;
  country: string;
  timezone: string;
  isPublic: boolean;
  createdAt: string;
  trialEndsAt: string;
  whatsappNumber?: string | null;
};

export type Branch = {
  id: string;
  orgId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  commissionPct?: number;
};

export type Membership = {
  avatarUrl: string;
  id: string;
  orgId: string;
  userId: string;
  userRole: "admin" | "doctor" | "receptionist";
  branchId?: string;
  status: "active" | "pending";
  inviteToken?: string;
  invitedEmail: string;
  memberName: string;
  createdAt: string;
  // Doctor-specific (populated when userRole === "doctor")
  bio?: string;
  specialties?: string[];
  websiteUrl?: string | null;
  acceptedInsurances?: string[];
  yearsOfExperience?: number | null;
  languagesSpoken?: string[];
};

// ── Schedule domain ───────────────────────────────────────────────────────────

export type WeeklySlot = {
  dayOfWeek: number; // 0=Sun..6=Sat
  startTime: string; // "HH:MM"
  endTime: string;
};

export type DoctorBranchSchedule = {
  id: string;
  doctorId: string;
  branchId: string;
  doctorName: string;
  specialty: string;
  weeklySlots: WeeklySlot[];
  fee: number;
  avgConsultationMin: number;
  defaultMaxBookings: number | null;
  isActive: boolean;
};

export type ScheduleException = {
  id: string;
  scheduleId: string;
  date: string; // "YYYY-MM-DD"
  reason: string;
};

// ── Billing domain ────────────────────────────────────────────────────────────

export type PlanTier = "trial" | "starter" | "growth" | "enterprise" | "business+";

export type SubscriptionPlan = {
  id: string;
  tier: PlanTier;
  name: string;
  pricePerMonth: number; // EGP; 0 = contact sales
  maxDoctors: number;
  maxAdmins: number;
  maxReceptionists: number;
  maxBranches: number;
  maxWhatsappNumbers: number;
  features: string[];
  marketplaceListing?: boolean;
  whatsappNotifications?: boolean;
};

export type Subscription = {
  id: string;
  orgId: string;
  planId: string;
  status: "trial" | "active" | "cancelled";
  currentPeriodEnd: string;
};

// ── Review domain ─────────────────────────────────────────────────────────────

export type ReviewSubmission = {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  rating: number; // 1–5
  comment: string;
  submittedAt: string;
  reviewToken: string;
};
