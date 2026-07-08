export type PaymentMethod = "paymob" | "clinic";

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
