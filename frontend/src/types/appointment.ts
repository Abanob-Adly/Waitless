export type AppointmentStatus =
  | "booked"
  | "called"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentSource = "marketplace" | "walk_in";

export type QueueAppointment = {
  id: string;
  queueNumber: number;
  patientName: string;
  phone?: string;
  source: AppointmentSource;
  joinedAt: string;
  estimatedWaitMin: number;
  status: AppointmentStatus;
};
