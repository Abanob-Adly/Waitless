export type Session = {
  id: string;
  doctorId: string;
  clinicId: string;
  clinicName: string;
  date: string;
  startTime: string;
  endTime: string;
  availableSlots: number;
  fee: number;
  status: "scheduled" | "active" | "ended";
};

export const mockSessions: Session[] = [
  // Dr. Layla Hassan
  {
    id: "ses-lh-001",
    doctorId: "layla-hassan",
    clinicId: "maadi",
    clinicName: "Layla Hassan Heart Center",
    date: "Mon, Jun 23, 2026",
    startTime: "09:00 AM",
    endTime: "01:00 PM",
    availableSlots: 5,
    fee: 350,
    status: "scheduled",
  },
  {
    id: "ses-lh-002",
    doctorId: "layla-hassan",
    clinicId: "new-cairo",
    clinicName: "New Cairo Medical Complex",
    date: "Tue, Jun 24, 2026",
    startTime: "10:00 AM",
    endTime: "02:00 PM",
    availableSlots: 3,
    fee: 350,
    status: "scheduled",
  },
  {
    id: "ses-lh-003",
    doctorId: "layla-hassan",
    clinicId: "maadi",
    clinicName: "Layla Hassan Heart Center",
    date: "Thu, Jun 26, 2026",
    startTime: "09:30 AM",
    endTime: "12:30 PM",
    availableSlots: 7,
    fee: 350,
    status: "scheduled",
  },
  // Dr. Omar Farouk
  {
    id: "ses-of-001",
    doctorId: "omar-farouk",
    clinicId: "heliopolis",
    clinicName: "Skin Care Center",
    date: "Mon, Jun 23, 2026",
    startTime: "10:00 AM",
    endTime: "02:00 PM",
    availableSlots: 4,
    fee: 250,
    status: "scheduled",
  },
  {
    id: "ses-of-002",
    doctorId: "omar-farouk",
    clinicId: "heliopolis",
    clinicName: "Skin Care Center",
    date: "Wed, Jun 25, 2026",
    startTime: "11:00 AM",
    endTime: "03:00 PM",
    availableSlots: 2,
    fee: 250,
    status: "scheduled",
  },
  // Dr. Sara Mostafa
  {
    id: "ses-sm-001",
    doctorId: "sara-mostafa",
    clinicId: "nasr-city",
    clinicName: "Children Care Clinic",
    date: "Tue, Jun 24, 2026",
    startTime: "09:00 AM",
    endTime: "01:00 PM",
    availableSlots: 6,
    fee: 200,
    status: "scheduled",
  },
  // Dr. Amr Khalil
  {
    id: "ses-ak-001",
    doctorId: "amr-khalil",
    clinicId: "new-cairo",
    clinicName: "New Cairo Medical Complex",
    date: "Wed, Jun 25, 2026",
    startTime: "11:00 AM",
    endTime: "03:00 PM",
    availableSlots: 2,
    fee: 400,
    status: "scheduled",
  },
];
