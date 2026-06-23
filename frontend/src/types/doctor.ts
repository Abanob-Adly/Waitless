export type ClinicLocation = {
  id: string;
  name: string;
  address: string;
  phone: string;
  area: string;
};

export type Doctor = {
  id: string;
  fullName: string;
  initials: string;
  title: string;
  specialty: string;
  rating: number;
  reviewsCount: number;
  consultationFee: number;
  availableLabel: string;
  area: string;

  verified: boolean;
  experienceYears: number;
  languages: string[];
  organizationName: string;
  bio: string;
  clinicLocations: ClinicLocation[];
  acceptedInsurance: string[];
};
