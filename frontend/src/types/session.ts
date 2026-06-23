export type SessionStatus = "scheduled" | "active" | "ended" | "cancelled";

export type DoctorSession = {
  id: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  branchName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  bookingsCount: number;
  currentServing: number;
  avgConsultationMin: number;
};
