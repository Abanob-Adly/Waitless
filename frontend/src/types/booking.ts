export type PaymentMethod = "card" | "vodafone_cash" | "pay_at_clinic";

export type BookingSummary = {
  id: string;
  doctorName: string;
  doctorInitials: string;
  doctorTitle: string;
  specialty: string;
  date: string;
  time: string;
  clinicName: string;
  area: string;
  total: number;
};
