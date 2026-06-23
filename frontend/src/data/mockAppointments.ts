import type { QueueAppointment } from "../types/appointment";

export const mockAppointments: QueueAppointment[] = [
  {
    id: "appt-001",
    queueNumber: 1,
    patientName: "Ahmed Youssef",
    phone: "0100-123-4567",
    source: "marketplace",
    joinedAt: "09:10",
    estimatedWaitMin: 0,
    status: "in_progress",
  },
  {
    id: "appt-002",
    queueNumber: 2,
    patientName: "Nadia Karim",
    phone: "0101-987-6543",
    source: "marketplace",
    joinedAt: "09:22",
    estimatedWaitMin: 12,
    status: "booked",
  },
  {
    id: "appt-003",
    queueNumber: 3,
    patientName: "Hassan Ali",
    phone: "0102-555-1234",
    source: "walk_in",
    joinedAt: "09:35",
    estimatedWaitMin: 24,
    status: "booked",
  },
  {
    id: "appt-004",
    queueNumber: 4,
    patientName: "Mariam Saad",
    source: "marketplace",
    joinedAt: "09:42",
    estimatedWaitMin: 36,
    status: "booked",
  },
];
