import type { Doctor, Session } from "../context/AppContext";

// ── Doctors ───────────────────────────────────────────────────────────────────

export const MOCK_DOCTORS: Doctor[] = [
  {
    id: "layla-hassan",
    initials: "LH",
    name: "Dr. Layla Hassan",
    title: "Consultant Cardiologist",
    specialty: "Cardiology",
    organization: "Cairo University Hospital",
    bio: "Board-certified cardiologist with 14 years of experience specializing in interventional cardiology and heart failure management. Fellow of the Egyptian Society of Cardiology with publications in multiple international peer-reviewed journals. Dr. Hassan leads a team of specialists and is known for her patient-centered approach.",
    rating: 4.9,
    reviewCount: 312,
    fee: 350,
    area: "Maadi",
    experienceYears: 14,
    languages: ["Arabic", "English"],
    verified: true,
    availableLabel: "Today",
    clinics: [
      {
        id: "maadi",
        name: "Layla Hassan Heart Center",
        address: "15 Road 9, Maadi, Cairo",
        phone: "02-25168800",
      },
      {
        id: "new-cairo",
        name: "New Cairo Medical Complex",
        address: "3rd District, 5th Settlement",
        phone: "02-24188800",
      },
    ],
    insurance: ["Allianz", "MetLife", "AXA", "Bupa"],
  },
  {
    id: "omar-farouk",
    initials: "OF",
    name: "Dr. Omar Farouk",
    title: "Senior Dermatologist",
    specialty: "Dermatology",
    organization: "Skin Care Center",
    bio: "Senior dermatologist with 10 years focused on clinical and cosmetic dermatology with a special interest in laser treatments and anti-aging procedures. Trained at the American University in Cairo and certified by the Egyptian Dermatological Society.",
    rating: 4.8,
    reviewCount: 526,
    fee: 250,
    area: "Heliopolis",
    experienceYears: 10,
    languages: ["Arabic", "English"],
    verified: true,
    availableLabel: "Available",
    clinics: [
      {
        id: "heliopolis",
        name: "Skin Care Center",
        address: "12 Al-Nozha St., Heliopolis, Cairo",
        phone: "02-26262626",
      },
    ],
    insurance: ["AXA", "Bupa"],
  },
  {
    id: "sara-mostafa",
    initials: "SM",
    name: "Dr. Sara Mostafa",
    title: "Pediatric Specialist",
    specialty: "Pediatrics",
    organization: "Children Care Clinic",
    bio: "Pediatric specialist with 8 years of experience focused on child health, preventive care, and family-centered treatment. Passionate about childhood nutrition and developmental milestones. Dr. Mostafa speaks openly about mental health and has built one of Cairo's most family-friendly practices.",
    rating: 4.9,
    reviewCount: 891,
    fee: 200,
    area: "Nasr City",
    experienceYears: 8,
    languages: ["Arabic", "English"],
    verified: true,
    availableLabel: "Today",
    clinics: [
      {
        id: "nasr-city",
        name: "Children Care Clinic",
        address: "Mostafa El-Nahas St., Nasr City, Cairo",
        phone: "02-24011111",
      },
    ],
    insurance: ["MetLife", "AXA"],
  },
  {
    id: "amr-khalil",
    initials: "AK",
    name: "Dr. Amr Khalil",
    title: "Orthopedic Surgeon",
    specialty: "Orthopedics",
    organization: "New Cairo Medical Complex",
    bio: "Orthopedic surgeon with 16 years of experience specializing in sports injuries, joint replacement, and complex fracture management. Trained at leading international institutions including the Royal National Orthopaedic Hospital (UK). Dr. Khalil has performed over 2,000 successful joint replacement procedures.",
    rating: 4.7,
    reviewCount: 204,
    fee: 400,
    area: "New Cairo",
    experienceYears: 16,
    languages: ["Arabic", "English", "French"],
    verified: true,
    availableLabel: "3d wait",
    clinics: [
      {
        id: "new-cairo",
        name: "New Cairo Medical Complex",
        address: "3rd District, 5th Settlement, Cairo",
        phone: "02-22222222",
      },
    ],
    insurance: ["Allianz", "Bupa"],
  },
];

// ── Sessions ──────────────────────────────────────────────────────────────────

export const MOCK_SESSIONS: Session[] = [
  // Dr. Layla Hassan
  { id: "ses-lh-001", doctorId: "layla-hassan", clinicId: "maadi", clinicName: "Layla Hassan Heart Center", date: "Mon, Jun 23, 2026", startTime: "09:00 AM", endTime: "01:00 PM", availableSlots: 5, avgConsultationMin: 12 },
  { id: "ses-lh-002", doctorId: "layla-hassan", clinicId: "new-cairo", clinicName: "New Cairo Medical Complex", date: "Tue, Jun 24, 2026", startTime: "10:00 AM", endTime: "02:00 PM", availableSlots: 3, avgConsultationMin: 12 },
  { id: "ses-lh-003", doctorId: "layla-hassan", clinicId: "maadi", clinicName: "Layla Hassan Heart Center", date: "Thu, Jun 26, 2026", startTime: "09:30 AM", endTime: "12:30 PM", availableSlots: 7, avgConsultationMin: 12 },
  // Dr. Omar Farouk
  { id: "ses-of-001", doctorId: "omar-farouk", clinicId: "heliopolis", clinicName: "Skin Care Center", date: "Mon, Jun 23, 2026", startTime: "10:00 AM", endTime: "02:00 PM", availableSlots: 4, avgConsultationMin: 12 },
  { id: "ses-of-002", doctorId: "omar-farouk", clinicId: "heliopolis", clinicName: "Skin Care Center", date: "Wed, Jun 25, 2026", startTime: "11:00 AM", endTime: "03:00 PM", availableSlots: 2, avgConsultationMin: 12 },
  // Dr. Sara Mostafa
  { id: "ses-sm-001", doctorId: "sara-mostafa", clinicId: "nasr-city", clinicName: "Children Care Clinic", date: "Tue, Jun 24, 2026", startTime: "09:00 AM", endTime: "01:00 PM", availableSlots: 6, avgConsultationMin: 12 },
  { id: "ses-sm-002", doctorId: "sara-mostafa", clinicId: "nasr-city", clinicName: "Children Care Clinic", date: "Thu, Jun 26, 2026", startTime: "10:00 AM", endTime: "02:00 PM", availableSlots: 4, avgConsultationMin: 12 },
  // Dr. Amr Khalil
  { id: "ses-ak-001", doctorId: "amr-khalil", clinicId: "new-cairo", clinicName: "New Cairo Medical Complex", date: "Wed, Jun 25, 2026", startTime: "11:00 AM", endTime: "03:00 PM", availableSlots: 2, avgConsultationMin: 12 },
];

// ── Reviews ───────────────────────────────────────────────────────────────────

export type Review = {
  id: string;
  doctorId: string;
  patientName: string;
  rating: number;
  date: string;
  comment: string;
};

export const MOCK_REVIEWS: Review[] = [
  // Dr. Layla Hassan
  { id: "rv-lh-01", doctorId: "layla-hassan", patientName: "Mohamed A.", rating: 5, date: "Jun 10, 2026", comment: "Exceptional doctor! Very professional and thorough. She took the time to explain every detail of my condition clearly. I left with a complete understanding of my treatment plan." },
  { id: "rv-lh-02", doctorId: "layla-hassan", patientName: "Heba S.", rating: 5, date: "May 28, 2026", comment: "The best cardiologist I have ever visited. Diagnosed my issue accurately and quickly. The Waitless queue system made the whole experience stress-free — no more waiting for hours." },
  { id: "rv-lh-03", doctorId: "layla-hassan", patientName: "Tarek M.", rating: 4, date: "May 15, 2026", comment: "Great doctor, very knowledgeable. Highly recommend. The only reason for 4 stars is that the appointment ran slightly over time, but that shows how thorough she is." },
  { id: "rv-lh-04", doctorId: "layla-hassan", patientName: "Nour K.", rating: 5, date: "Apr 20, 2026", comment: "Dr. Hassan is incredibly patient and caring. She answered all my questions without rushing me. I have recommended her to my entire family." },
  // Dr. Omar Farouk
  { id: "rv-of-01", doctorId: "omar-farouk", patientName: "Rana T.", rating: 5, date: "Jun 15, 2026", comment: "Outstanding dermatologist. He diagnosed my skin issue in minutes and the treatment he prescribed worked within a week. Very friendly and professional." },
  { id: "rv-of-02", doctorId: "omar-farouk", patientName: "Ahmed H.", rating: 4, date: "Jun 2, 2026", comment: "Good experience overall. Dr. Farouk is knowledgeable and the clinic is very clean. The online booking through Waitless saved me a lot of time." },
  { id: "rv-of-03", doctorId: "omar-farouk", patientName: "Sara W.", rating: 5, date: "May 20, 2026", comment: "Fantastic doctor! My skin has never looked better. He explained every step of the treatment process and was very reassuring." },
  // Dr. Sara Mostafa
  { id: "rv-sm-01", doctorId: "sara-mostafa", patientName: "Mona F.", rating: 5, date: "Jun 18, 2026", comment: "Dr. Sara is absolutely wonderful with children. My son was very anxious but she immediately made him feel at ease. Such a caring and skilled pediatrician." },
  { id: "rv-sm-02", doctorId: "sara-mostafa", patientName: "Karim P.", rating: 5, date: "Jun 5, 2026", comment: "We have been taking our kids to Dr. Sara for 3 years now and she is simply the best. Always up to date on the latest research and genuinely cares about her patients." },
  { id: "rv-sm-03", doctorId: "sara-mostafa", patientName: "Dina A.", rating: 4, date: "May 12, 2026", comment: "Very thorough and patient with my daughter. The waiting time via the app was minimal. Will definitely be returning." },
  // Dr. Amr Khalil
  { id: "rv-ak-01", doctorId: "amr-khalil", patientName: "Sherif L.", rating: 5, date: "Jun 20, 2026", comment: "World-class orthopedic surgeon. He performed my knee replacement and the results are incredible. I am walking pain-free for the first time in years. Thank you Dr. Amr!" },
  { id: "rv-ak-02", doctorId: "amr-khalil", patientName: "Yasmin O.", rating: 4, date: "Jun 8, 2026", comment: "Very experienced surgeon. He explained all my options thoroughly before recommending surgery. I felt very informed and confident in my decision." },
  { id: "rv-ak-03", doctorId: "amr-khalil", patientName: "Omar B.", rating: 5, date: "May 30, 2026", comment: "Excellent doctor with a great bedside manner. Fixed my sports injury and I was back on the field in 6 weeks as he predicted. Highly recommend." },
];

// ── Filter options ────────────────────────────────────────────────────────────

export const SPECIALTIES = [
  "All Specialties",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Orthopedics",
];

export const AREAS = [
  "All Areas",
  "Maadi",
  "Heliopolis",
  "Nasr City",
  "New Cairo",
];
