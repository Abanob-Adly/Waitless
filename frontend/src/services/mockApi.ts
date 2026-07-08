import { MOCK_DOCTORS, MOCK_SESSIONS } from "../data/mockData";
import type {
  Doctor,
  Session,
  PatientProfile,
  DoctorAccount,
  AdminAccount,
  ReceptionistAccount,
  AuthUser,
  BookingPayload,
  PaymentPayload,
  PatientSignupPayload,
  DoctorSignupPayload,
  OrgOnboardingPayload,
  InviteAcceptPayload,
  Organization,
  Branch,
  Membership,
  DoctorBranchSchedule,
  ScheduleException,
  SubscriptionPlan,
  Subscription,
  ReviewSubmission,
  WeeklySlot,
} from "../types/index";

// ── Delay helper ──────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Queue shared state ────────────────────────────────────────────────────────

const DEMO_MS_PER_MIN = 3_000;

type ServingState = { currentServing: number; nextAdvanceAt: number };

const _servingState = new Map<string, ServingState>();
const _appointmentIndex = new Map<string, { doctorId: string; avgMin: number }>();
const _authToListing = new Map([["d-demo-001", "layla-hassan"]]);

const DEMO_QUEUE_PATIENTS: Omit<QueuePatient, "status">[] = [
  { id: "q-001", displayName: "Patient #1", queueNumber: 1, arrivalTime: "09:05" },
  { id: "q-002", displayName: "Patient #2", queueNumber: 2, arrivalTime: "09:12" },
  { id: "q-003", displayName: "Patient #3", queueNumber: 3, arrivalTime: "09:20" },
  { id: "q-004", displayName: "Patient #4", queueNumber: 4, arrivalTime: "09:35" },
  { id: "q-005", displayName: "Patient #5", queueNumber: 5, arrivalTime: "09:41" },
  { id: "q-006", displayName: "Patient #6", queueNumber: 6, arrivalTime: "09:55" },
];

// Per-session queue store (for real sessions opened via openSession)
const _sessionQueueStore = new Map<string, QueuePatient[]>();

// ── Mutable session store (copy of MOCK_SESSIONS so statuses can change) ──────

const _sessionStore: Session[] = [...MOCK_SESSIONS];

// ── Organization domain seed data ─────────────────────────────────────────────

const DEMO_ORG: Organization = {
  id: "org-demo-001",
  name: "Cairo Medical Group",
  type: "polyclinic",
  country: "EG",
  timezone: "Africa/Cairo",
  isPublic: true,
  createdAt: "2026-06-01T00:00:00Z",
  trialEndsAt: "2026-07-01T00:00:00Z",
};

const DEMO_BRANCH_1: Branch = {
  id: "br-001",
  orgId: "org-demo-001",
  name: "Maadi Branch",
  address: "15 Road 9, Maadi",
  city: "Cairo",
  phone: "02-25168800",
};

const DEMO_BRANCH_2: Branch = {
  id: "br-002",
  orgId: "org-demo-001",
  name: "Nasr City Branch",
  address: "Mostafa El-Nahas St.",
  city: "Cairo",
  phone: "02-24011111",
};

const DEMO_ADMIN: AdminAccount = {
  id: "admin-demo-001",
  name: "Khaled Mansour",
  phone: "01011112222",
  email: "admin@cairomed.eg",
  password: "Admin1234",
  orgId: "org-demo-001",
};

const DEMO_RECEPTIONIST: ReceptionistAccount = {
  id: "rec-demo-001",
  name: "Noura Saleh",
  phone: "01033334444",
  email: "noura@cairomed.eg",
  password: "Recept1234",
  orgId: "org-demo-001",
  branchId: "br-001",
};

const DEMO_SUBSCRIPTION: Subscription = {
  id: "sub-001",
  orgId: "org-demo-001",
  planId: "plan-starter",
  status: "active",
  currentPeriodEnd: "2026-07-01T00:00:00Z",
};

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "plan-trial",
    tier: "trial",
    name: "Free Trial",
    pricePerMonth: 0,
    maxDoctors: 1,
    maxBranches: 1,
    features: ["1 doctor", "1 branch", "Queue management", "30-day trial"],
  },
  {
    id: "plan-starter",
    tier: "starter",
    name: "Starter",
    pricePerMonth: 299,
    maxDoctors: 3,
    maxBranches: 1,
    features: ["3 doctors", "1 branch", "Analytics", "Email support"],
  },
  {
    id: "plan-growth",
    tier: "growth",
    name: "Growth",
    pricePerMonth: 799,
    maxDoctors: 10,
    maxBranches: 3,
    features: ["10 doctors", "3 branches", "Advanced analytics", "Priority support"],
  },
  {
    id: "plan-enterprise",
    tier: "enterprise",
    name: "Enterprise",
    pricePerMonth: 0,
    maxDoctors: 999,
    maxBranches: 999,
    features: ["Unlimited doctors", "Unlimited branches", "Dedicated support"],
  },
];

// ── User stores ───────────────────────────────────────────────────────────────

const _patientStore: PatientProfile[] = [
  {
    id: "p-demo-001",
    name: "Ahmed Mohamed",
    phone: "01012345678",
    birthdate: "1990-05-15",
    email: "ahmed@example.com",
    password: "Ahmed1234",
  },
];

const _doctorStore: DoctorAccount[] = [
  {
    id: "d-demo-001",
    name: "Dr. Layla Hassan",
    phone: "01198765432",
    specialty: "Cardiology",
    licenseNumber: "EG-001234",
    password: "Doctor1234",
  },
];

const _adminStore: AdminAccount[] = [DEMO_ADMIN];

const _receptionistStore: ReceptionistAccount[] = [DEMO_RECEPTIONIST];

// ── Organization stores ───────────────────────────────────────────────────────

const _orgStore: Organization[] = [DEMO_ORG];

const _branchStore: Branch[] = [DEMO_BRANCH_1, DEMO_BRANCH_2];

const _membershipStore: Membership[] = [
  {
    id: "mem-001",
    orgId: "org-demo-001",
    userId: "admin-demo-001",
    userRole: "admin",
    status: "active",
    invitedEmail: "admin@cairomed.eg",
    memberName: "Khaled Mansour",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "mem-002",
    orgId: "org-demo-001",
    userId: "rec-demo-001",
    userRole: "receptionist",
    branchId: "br-001",
    status: "active",
    invitedEmail: "noura@cairomed.eg",
    memberName: "Noura Saleh",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    id: "mem-003",
    orgId: "org-demo-001",
    userId: "d-demo-001",
    userRole: "doctor",
    branchId: "br-001",
    status: "active",
    invitedEmail: "layla@cairomed.eg",
    memberName: "Dr. Layla Hassan",
    createdAt: "2026-06-01T00:00:00Z",
  },
];

const _scheduleStore: DoctorBranchSchedule[] = [];
const _scheduleExceptionStore: ScheduleException[] = [];
const _subscriptionStore: Subscription[] = [DEMO_SUBSCRIPTION];
const _reviewStore: ReviewSubmission[] = [];

// ── Auth API ──────────────────────────────────────────────────────────────────

export async function signupPatient(
  data: PatientSignupPayload,
): Promise<{ success: boolean; profile?: PatientProfile; error?: string }> {
  await delay(800);
  if (_patientStore.some((p) => p.phone === data.phone)) {
    return { success: false, error: "This phone number is already registered." };
  }
  const profile: PatientProfile = {
    id: `p-${Date.now()}`,
    name: data.name,
    phone: data.phone,
    birthdate: data.birthdate,
    email: data.email,
    password: data.password,
  };
  _patientStore.push(profile);
  return { success: true, profile };
}

export async function signupDoctor(
  data: DoctorSignupPayload,
): Promise<{ success: boolean; profile?: DoctorAccount; error?: string }> {
  await delay(800);
  if (
    _doctorStore.some((d) => d.phone === data.phone) ||
    _doctorStore.some((d) => d.licenseNumber === data.licenseNumber)
  ) {
    return {
      success: false,
      error: "This phone number or license number is already registered.",
    };
  }
  const profile: DoctorAccount = {
    id: `d-${Date.now()}`,
    name: data.name,
    phone: data.phone,
    specialty: data.specialty,
    licenseNumber: data.licenseNumber,
    password: data.password,
  };
  _doctorStore.push(profile);
  return { success: true, profile };
}

export async function loginUser(
  phone: string,
  password: string,
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  await delay(600);

  const patient = _patientStore.find(
    (p) => p.phone === phone && p.password === password,
  );
  if (patient) return { success: true, user: { role: "patient", profile: patient } };

  const doctor = _doctorStore.find(
    (d) => d.phone === phone && d.password === password,
  );
  if (doctor) return { success: true, user: { role: "doctor", profile: doctor } };

  const admin = _adminStore.find(
    (a) => a.phone === phone && a.password === password,
  );
  if (admin) return { success: true, user: { role: "admin", profile: admin } };

  const rec = _receptionistStore.find(
    (r) => r.phone === phone && r.password === password,
  );
  if (rec) return { success: true, user: { role: "receptionist", profile: rec } };

  return { success: false, error: "Incorrect phone number or password." };
}

// ── Org Onboarding (Workflow 1) ────────────────────────────────────────────────

export async function onboardOrg(
  payload: OrgOnboardingPayload,
): Promise<{ success: boolean; orgId?: string; error?: string }> {
  await delay(1000);

  if (_adminStore.some((a) => a.phone === payload.adminPhone)) {
    return { success: false, error: "This phone number is already registered." };
  }

  const orgId = `org-${Date.now()}`;
  const adminId = `admin-${Date.now()}`;

  const now = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const org: Organization = {
    id: orgId,
    name: payload.orgName,
    type: payload.orgType,
    country: payload.country,
    timezone: payload.timezone,
    isPublic: payload.isPublic,
    createdAt: now,
    trialEndsAt: trialEnd,
  };

  const admin: AdminAccount = {
    id: adminId,
    name: payload.adminName,
    phone: payload.adminPhone,
    email: payload.adminEmail,
    password: payload.adminPassword,
    orgId,
  };

  const membership: Membership = {
    id: `mem-${Date.now()}`,
    orgId,
    userId: adminId,
    userRole: "admin",
    status: "active",
    invitedEmail: payload.adminEmail,
    memberName: payload.adminName,
    createdAt: now,
  };

  const subscription: Subscription = {
    id: `sub-${Date.now()}`,
    orgId,
    planId: "plan-trial",
    status: "trial",
    currentPeriodEnd: trialEnd,
  };

  _orgStore.push(org);
  _adminStore.push(admin);
  _membershipStore.push(membership);
  _subscriptionStore.push(subscription);

  return { success: true, orgId };
}

// ── Branch Management (Workflow 2) ────────────────────────────────────────────

export async function fetchOrgById(orgId: string): Promise<Organization | null> {
  await delay(200);
  return _orgStore.find((o) => o.id === orgId) ?? null;
}

export async function fetchBranches(orgId: string): Promise<Branch[]> {
  await delay(200);
  return _branchStore.filter((b) => b.orgId === orgId);
}

export async function addBranch(
  orgId: string,
  data: Omit<Branch, "id" | "orgId">,
): Promise<{ success: boolean; branch?: Branch; error?: string }> {
  await delay(600);
  const branch: Branch = {
    id: `br-${Date.now()}`,
    orgId,
    ...data,
  };
  _branchStore.push(branch);
  return { success: true, branch };
}

// ── Staff Invitations (Workflow 3) ────────────────────────────────────────────

export async function fetchMemberships(orgId: string): Promise<Membership[]> {
  await delay(200);
  return _membershipStore.filter((m) => m.orgId === orgId);
}

export async function inviteStaff(
  orgId: string,
  branchId: string,
  email: string,
  role: "doctor" | "receptionist" | "admin",
  memberName: string,
): Promise<{ success: boolean; token?: string; error?: string }> {
  await delay(600);

  const token = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const membership: Membership = {
    id: `mem-${Date.now()}`,
    orgId,
    userId: "",
    userRole: role,
    branchId: branchId || undefined,
    status: "pending",
    inviteToken: token,
    invitedEmail: email,
    memberName,
    createdAt: new Date().toISOString(),
  };

  _membershipStore.push(membership);
  return { success: true, token };
}

export async function fetchMembershipByToken(
  token: string,
): Promise<Membership | null> {
  await delay(300);
  return _membershipStore.find((m) => m.inviteToken === token) ?? null;
}

export async function acceptInvite(
  payload: InviteAcceptPayload,
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  await delay(800);

  const membership = _membershipStore.find(
    (m) => m.inviteToken === payload.token && m.status === "pending",
  );
  if (!membership) {
    return { success: false, error: "Invalid or expired invitation token." };
  }

  // Check phone not taken
  const phoneTaken =
    _patientStore.some((p) => p.phone === payload.phone) ||
    _doctorStore.some((d) => d.phone === payload.phone) ||
    _adminStore.some((a) => a.phone === payload.phone) ||
    _receptionistStore.some((r) => r.phone === payload.phone);

  if (phoneTaken) {
    return { success: false, error: "This phone number is already registered." };
  }

  let user: AuthUser = null;

  if (membership.userRole === "admin") {
    const account: AdminAccount = {
      id: `admin-${Date.now()}`,
      name: payload.name,
      phone: payload.phone,
      email: membership.invitedEmail,
      password: payload.password,
      orgId: membership.orgId,
    };
    _adminStore.push(account);
    membership.userId = account.id;
    user = { role: "admin", profile: account };
  } else if (membership.userRole === "receptionist") {
    const account: ReceptionistAccount = {
      id: `rec-${Date.now()}`,
      name: payload.name,
      phone: payload.phone,
      email: membership.invitedEmail,
      password: payload.password,
      orgId: membership.orgId,
      branchId: membership.branchId ?? "",
    };
    _receptionistStore.push(account);
    membership.userId = account.id;
    user = { role: "receptionist", profile: account };
  } else {
    const account: DoctorAccount = {
      id: `d-${Date.now()}`,
      name: payload.name,
      phone: payload.phone,
      specialty: "General Practice",
      licenseNumber: `LIC-${Date.now()}`,
      password: payload.password,
    };
    _doctorStore.push(account);
    membership.userId = account.id;
    user = { role: "doctor", profile: account };
  }

  membership.status = "active";
  membership.memberName = payload.name;

  return { success: true, user };
}

// ── Doctor Schedules (Workflows 4–6) ──────────────────────────────────────────

export async function fetchSchedules(orgId: string): Promise<DoctorBranchSchedule[]> {
  await delay(200);
  // Return schedules whose branchId belongs to this org
  const orgBranchIds = _branchStore
    .filter((b) => b.orgId === orgId)
    .map((b) => b.id);
  return _scheduleStore.filter((s) => orgBranchIds.includes(s.branchId));
}

export async function createDoctorSchedule(
  data: Omit<DoctorBranchSchedule, "id">,
): Promise<{
  success: boolean;
  schedule?: DoctorBranchSchedule;
  sessionsGenerated?: number;
}> {
  await delay(800);

  const schedule: DoctorBranchSchedule = {
    id: `sch-${Date.now()}`,
    ...data,
  };
  _scheduleStore.push(schedule);

  const generated = generateSessionsForSchedule(schedule, 14);
  generated.forEach((s) => _sessionStore.push(s));

  return { success: true, schedule, sessionsGenerated: generated.length };
}

function generateSessionsForSchedule(
  schedule: DoctorBranchSchedule,
  daysAhead: number,
): Session[] {
  const sessions: Session[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i <= daysAhead; i++) {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dow = date.getDay();

    const matchingSlots = schedule.weeklySlots.filter(
      (slot) => slot.dayOfWeek === dow,
    );

    matchingSlots.forEach((slot: WeeklySlot) => {
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const branch = _branchStore.find((b) => b.id === schedule.branchId);
      const id = `ses-gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      sessions.push({
        id,
        doctorId: schedule.doctorId,
        clinicId: schedule.branchId,
        clinicName: branch?.name ?? "Clinic",
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        availableSlots: 10,
        avgConsultationMin: schedule.avgConsultationMin,
        status: "scheduled",
        queueToken: `tk_gen_${id.slice(-8)}`,
        scheduleId: schedule.id,
      });
    });
  }

  return sessions;
}

export async function addScheduleException(
  scheduleId: string,
  date: string,
  reason: string,
): Promise<{ success: boolean; cancelledSessionId?: string }> {
  await delay(600);

  const exception: ScheduleException = {
    id: `exc-${Date.now()}`,
    scheduleId,
    date,
    reason,
  };
  _scheduleExceptionStore.push(exception);

  // Find the session for this scheduleId + date and cancel it
  const session = _sessionStore.find(
    (s) => s.scheduleId === scheduleId && s.date.includes(date),
  );
  if (session) {
    session.status = "closed";
    return { success: true, cancelledSessionId: session.id };
  }

  return { success: true };
}

// ── Session Lifecycle (Workflow 7) ────────────────────────────────────────────

export async function fetchSessionsForBranch(
  branchId: string,
  _date: string,
): Promise<Session[]> {
  await delay(300);
  return _sessionStore.filter((s) => s.clinicId === branchId);
}

export async function openSession(
  sessionId: string,
): Promise<{ success: boolean }> {
  await delay(400);
  const session = _sessionStore.find((s) => s.id === sessionId);
  if (!session) return { success: false };
  session.status = "active";
  if (!_sessionQueueStore.has(sessionId)) {
    _sessionQueueStore.set(sessionId, []);
  }
  return { success: true };
}

export async function closeSession(
  sessionId: string,
): Promise<{ success: boolean; cancelledCount: number }> {
  await delay(400);
  const session = _sessionStore.find((s) => s.id === sessionId);
  if (!session) return { success: false, cancelledCount: 0 };
  session.status = "closed";

  const queue = _sessionQueueStore.get(sessionId) ?? [];
  const cancelledCount = queue.filter((p) => p.status === "waiting").length;
  queue.forEach((p) => {
    if (p.status === "waiting") p.status = "done";
  });

  return { success: true, cancelledCount };
}

// ── Walk-In (Workflow 9) ──────────────────────────────────────────────────────

export async function lookupPatientByPhone(
  phone: string,
): Promise<PatientProfile | null> {
  await delay(400);
  return _patientStore.find((p) => p.phone === phone) ?? null;
}

export async function walkInBooking(payload: {
  sessionId: string;
  doctorId: string;
  patientId: string;
  avgConsultationMin: number;
}): Promise<{ appointmentId: string; queueNumber: number }> {
  await delay(600);

  const appointmentId = `wi-${payload.sessionId}-${Date.now()}`;

  const queue = _sessionQueueStore.get(payload.sessionId) ?? [];
  const queueNumber = queue.length + 1;

  const patient = _patientStore.find((p) => p.id === payload.patientId);
  const newPatient: QueuePatient = {
    id: payload.patientId,
    displayName: patient?.name ?? `Walk-in #${queueNumber}`,
    queueNumber,
    arrivalTime: new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: "waiting",
  };

  queue.push(newPatient);
  _sessionQueueStore.set(payload.sessionId, queue);

  // Register in appointment index for queue status polling
  if (!_servingState.has(payload.doctorId)) {
    _servingState.set(payload.doctorId, {
      currentServing: 0,
      nextAdvanceAt: Date.now() + payload.avgConsultationMin * DEMO_MS_PER_MIN,
    });
  }
  _appointmentIndex.set(appointmentId, {
    doctorId: payload.doctorId,
    avgMin: payload.avgConsultationMin,
  });

  return { appointmentId, queueNumber };
}

// ── Doctor listing API ────────────────────────────────────────────────────────

export async function fetchDoctors(
  filters?: { specialty?: string; area?: string },
): Promise<Doctor[]> {
  await delay(400);
  return MOCK_DOCTORS.filter((d) => {
    const okSpecialty = !filters?.specialty || d.specialty === filters.specialty;
    const okArea = !filters?.area || d.area === filters.area;
    return okSpecialty && okArea;
  });
}

export async function fetchDoctorProfile(id: string): Promise<Doctor | null> {
  await delay(300);
  return MOCK_DOCTORS.find((d) => d.id === id) ?? null;
}

export async function fetchSessions(doctorId: string): Promise<Session[]> {
  await delay(300);
  return _sessionStore.filter(
    (s) => s.doctorId === doctorId && s.status !== "closed",
  );
}

// ── Booking API ───────────────────────────────────────────────────────────────

export async function submitBooking(
  payload: BookingPayload,
): Promise<{ appointmentId: string; queueNumber: number }> {
  await delay(1200);
  const appointmentId = `bk-${payload.doctorId}-${Date.now()}`;
  const queueNumber = Math.floor(Math.random() * 6) + 4; // 4–9
  const avgMin = payload.avgConsultationMin ?? 10;

  if (!_servingState.has(payload.doctorId)) {
    _servingState.set(payload.doctorId, {
      currentServing: Math.max(0, queueNumber - 3),
      nextAdvanceAt: Date.now() + avgMin * DEMO_MS_PER_MIN,
    });
  }

  _appointmentIndex.set(appointmentId, { doctorId: payload.doctorId, avgMin });

  return { appointmentId, queueNumber };
}

export async function cancelAppointment(appointmentId: string): Promise<void> {
  await delay(600);
  _appointmentIndex.delete(appointmentId);
}

// ── Payment API ───────────────────────────────────────────────────────────────

export async function processPayment(
  payload: PaymentPayload,
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  await delay(payload.method === "paymob" ? 1800 : 1000);
  if (payload.method === "paymob" && Math.random() > 0.7) {
    return {
      success: false,
      error:
        "Payment declined. Please try again or choose a different payment method.",
    };
  }
  const txn = `TXN-${payload.appointmentId.slice(-6).toUpperCase()}-${Math.floor(
    Math.random() * 99999,
  )}`;
  return { success: true, transactionId: txn };
}

// ── Queue API (patient-side) ──────────────────────────────────────────────────

export async function fetchQueueStatus(
  appointmentId: string,
  queueNumber: number,
): Promise<{ currentServing: number }> {
  await delay(100);

  const info = _appointmentIndex.get(appointmentId);
  if (!info) {
    return { currentServing: Math.max(0, queueNumber - 3) };
  }

  const existing = _servingState.get(info.doctorId);
  const state: ServingState = existing ?? {
    currentServing: Math.max(0, queueNumber - 3),
    nextAdvanceAt: Date.now() + info.avgMin * DEMO_MS_PER_MIN,
  };

  const now = Date.now();
  if (now >= state.nextAdvanceAt && state.currentServing < queueNumber) {
    const updated: ServingState = {
      currentServing: state.currentServing + 1,
      nextAdvanceAt: now + info.avgMin * DEMO_MS_PER_MIN,
    };
    _servingState.set(info.doctorId, updated);
    return { currentServing: updated.currentServing };
  }

  if (!existing) _servingState.set(info.doctorId, state);
  return { currentServing: state.currentServing };
}

// ── Booking notes API ─────────────────────────────────────────────────────────

export async function updateBookingNotes(
  _appointmentId: string,
  _notes: string,
): Promise<void> {
  await delay(300);
}

// ── Doctor dashboard API ──────────────────────────────────────────────────────

export type QueuePatient = {
  id: string;
  displayName: string;
  queueNumber: number;
  arrivalTime: string;
  status: "waiting" | "serving" | "done" | "skipped" | "no_show";
};

export async function fetchDoctorQueue(
  doctorAuthId: string,
  sessionId?: string,
): Promise<QueuePatient[]> {
  await delay(200);

  // If sessionId provided, return real session queue
  if (sessionId) {
    return _sessionQueueStore.get(sessionId) ?? [];
  }

  // Fallback to shared demo queue keyed by listing ID
  const listingId = _authToListing.get(doctorAuthId) ?? doctorAuthId;
  const currentServing = _servingState.get(listingId)?.currentServing ?? 2;

  return DEMO_QUEUE_PATIENTS.map((p) => ({
    ...p,
    status:
      p.queueNumber < currentServing
        ? "done"
        : p.queueNumber === currentServing
          ? "serving"
          : "waiting",
  }));
}

export async function markPatientServed(
  _patientId: string,
  doctorAuthId: string,
  avgConsultationMin = 10,
): Promise<void> {
  await delay(200);

  const listingId = _authToListing.get(doctorAuthId) ?? doctorAuthId;
  const prev = _servingState.get(listingId);
  _servingState.set(listingId, {
    currentServing: (prev?.currentServing ?? 0) + 1,
    nextAdvanceAt: Date.now() + avgConsultationMin * DEMO_MS_PER_MIN,
  });
}

// ── Queue Runtime (Workflows 12–13) ──────────────────────────────────────────

export async function skipPatient(
  patientId: string,
  sessionId: string,
): Promise<void> {
  await delay(300);
  const queue = _sessionQueueStore.get(sessionId);
  if (!queue) return;
  const patient = queue.find((p) => p.id === patientId);
  if (!patient) return;
  patient.status = "skipped";
  // Move to end of queue with updated queue number
  queue.splice(queue.indexOf(patient), 1);
  patient.queueNumber = Math.max(...queue.map((p) => p.queueNumber), 0) + 1;
  patient.status = "waiting";
  queue.push(patient);
}

export async function markNoShow(
  patientId: string,
  sessionId: string,
): Promise<void> {
  await delay(300);
  const queue = _sessionQueueStore.get(sessionId);
  if (!queue) return;
  const patient = queue.find((p) => p.id === patientId);
  if (patient) patient.status = "no_show";
}

export async function checkInPatient(
  patientId: string,
  sessionId: string,
): Promise<void> {
  await delay(300);
  const queue = _sessionQueueStore.get(sessionId);
  if (!queue) return;
  const patient = queue.find((p) => p.id === patientId);
  if (patient && patient.status === "serving") {
    patient.status = "done";
  }
}

// ── Public Live Queue (Workflow 15) ───────────────────────────────────────────

export async function fetchQueueByToken(token: string): Promise<{
  session: Session;
  doctorName: string;
  queue: QueuePatient[];
} | null> {
  await delay(300);

  const session = _sessionStore.find((s) => s.queueToken === token);
  if (!session) return null;

  const doctor = MOCK_DOCTORS.find((d) => d.id === session.doctorId);
  const doctorName = doctor?.name ?? "Doctor";

  // For active sessions with real queue
  if (_sessionQueueStore.has(session.id)) {
    return {
      session,
      doctorName,
      queue: _sessionQueueStore.get(session.id) ?? [],
    };
  }

  // For demo sessions, build a derived queue from serving state
  const listingId = session.doctorId;
  const currentServing = _servingState.get(listingId)?.currentServing ?? 2;
  const queue: QueuePatient[] = DEMO_QUEUE_PATIENTS.map((p) => ({
    ...p,
    status:
      p.queueNumber < currentServing
        ? "done"
        : p.queueNumber === currentServing
          ? "serving"
          : "waiting",
  }));

  return { session, doctorName, queue };
}

// ── Billing (Workflow 16) ─────────────────────────────────────────────────────

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  await delay(200);
  return SUBSCRIPTION_PLANS;
}

export async function fetchSubscription(
  orgId: string,
): Promise<Subscription | null> {
  await delay(200);
  return _subscriptionStore.find((s) => s.orgId === orgId) ?? null;
}

export async function updateSubscription(
  orgId: string,
  planId: string,
): Promise<{ success: boolean; subscription?: Subscription }> {
  await delay(600);

  const existing = _subscriptionStore.find((s) => s.orgId === orgId);
  if (existing) {
    existing.planId = planId;
    existing.status = "active";
    existing.currentPeriodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    return { success: true, subscription: existing };
  }

  const subscription: Subscription = {
    id: `sub-${Date.now()}`,
    orgId,
    planId,
    status: "active",
    currentPeriodEnd: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
  _subscriptionStore.push(subscription);
  return { success: true, subscription };
}

// ── Reviews (Workflow 17) ─────────────────────────────────────────────────────

export async function fetchReviewByToken(token: string): Promise<{
  appointmentId: string;
  doctorId: string;
  doctorName: string;
} | null> {
  await delay(300);

  // token format: "rev-{appointmentId}"
  if (!token.startsWith("rev-")) return null;
  const appointmentId = token.slice(4);

  // Check if already reviewed
  if (_reviewStore.some((r) => r.appointmentId === appointmentId)) return null;

  // Look up appointment to find doctorId
  const info = _appointmentIndex.get(appointmentId);
  const doctorId = info?.doctorId ?? "layla-hassan"; // fallback for history records

  const doctor = MOCK_DOCTORS.find((d) => d.id === doctorId);
  if (!doctor) return null;

  return { appointmentId, doctorId, doctorName: doctor.name };
}

export async function submitReview(
  token: string,
  rating: number,
  comment: string,
): Promise<{ success: boolean }> {
  await delay(800);

  if (!token.startsWith("rev-")) return { success: false };
  const appointmentId = token.slice(4);

  if (_reviewStore.some((r) => r.appointmentId === appointmentId)) {
    return { success: false };
  }

  const info = _appointmentIndex.get(appointmentId);
  const doctorId = info?.doctorId ?? "layla-hassan";

  const review: ReviewSubmission = {
    id: `rev-${Date.now()}`,
    appointmentId,
    doctorId,
    patientId: "p-demo-001",
    rating,
    comment,
    submittedAt: new Date().toISOString(),
    reviewToken: token,
  };
  _reviewStore.push(review);

  // Update doctor running average in MOCK_DOCTORS
  const doctor = MOCK_DOCTORS.find((d) => d.id === doctorId);
  if (doctor) {
    const total = doctor.reviewCount + 1;
    doctor.rating =
      Math.round(((doctor.rating * doctor.reviewCount + rating) / total) * 10) / 10;
    doctor.reviewCount = total;
  }

  return { success: true };
}
