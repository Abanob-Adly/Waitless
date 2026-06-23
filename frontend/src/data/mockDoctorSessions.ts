import type { DoctorSession } from "../types/session";

export const mockDoctorSessions: DoctorSession[] = [
  {
    id: "session-001",
    doctorName: "Dr. Layla Hassan",
    specialty: "Cardiology",
    clinicName: "Layla Hassan Heart Center",
    branchName: "Maadi Branch",
    date: "Mon, Mar 16, 2026",
    startTime: "09:00 AM",
    endTime: "02:00 PM",
    status: "active",
    bookingsCount: 7,
    currentServing: 1,
    avgConsultationMin: 12,
  },
  {
    id: "session-002",
    doctorName: "Dr. Layla Hassan",
    specialty: "Cardiology",
    clinicName: "New Cairo Medical Complex",
    branchName: "New Cairo Branch",
    date: "Tue, Mar 17, 2026",
    startTime: "10:00 AM",
    endTime: "03:00 PM",
    status: "scheduled",
    bookingsCount: 4,
    currentServing: 0,
    avgConsultationMin: 15,
  },
];
