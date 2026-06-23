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
  specialty: string;
  licenseNumber: string;
  password: string;
};

export type AuthRole = "patient" | "doctor";

export type AuthUser =
  | { role: "patient"; profile: PatientProfile }
  | { role: "doctor"; profile: DoctorAccount }
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
};

// ── Booking ───────────────────────────────────────────────────────────────────

export type ActiveBooking = {
  id: string;
  doctor: Doctor;
  session: Session;
  queueNumber: number;
  paymentMethod: "card" | "vodafone" | "clinic";
  paymentStatus: "success" | "failed" | "pending";
  transactionId?: string;
  patientNotes?: string;
  last4?: string;
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
