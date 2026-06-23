import type { Doctor } from "../../types/doctor";
import { Link } from "react-router-dom";
type DoctorCardProps = {
  doctor: Doctor;
};

export function DoctorCard({ doctor }: DoctorCardProps) {
  return (
    <article className="rounded-md border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-lg font-bold text-navy">
          {doctor.initials}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl font-bold text-navy">
            {doctor.fullName}
          </h3>

          <p className="mt-1 text-sm text-navy-mid">{doctor.title}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gold">★★★★★</span>
            <span className="font-medium text-navy">{doctor.rating}</span>
            <span className="text-navy-mid">({doctor.reviewsCount})</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-sm bg-gold-tint px-2 py-1 text-xs font-medium text-navy">
              {doctor.specialty}
            </span>
            <span className="rounded-sm bg-green-50 px-2 py-1 text-xs font-medium text-success">
              {doctor.availableLabel}
            </span>
            <span className="rounded-sm border border-border px-2 py-1 text-xs text-navy-mid">
              {doctor.area}
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="font-heading text-2xl font-bold text-gold">
              {doctor.consultationFee}
              <span className="ml-1 font-body text-sm font-medium text-navy-mid">
                EGP
              </span>
            </p>

            <Link
              to={`/doctors/${doctor.id}`}
              className="inline-flex h-8 items-center justify-center rounded-sm bg-gold px-3 text-sm font-medium text-navy transition hover:bg-gold-light"
            >
              View Profile
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
