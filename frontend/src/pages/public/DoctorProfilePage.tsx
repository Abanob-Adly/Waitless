import { Link, useParams } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { BookingWidget } from "../../components/doctor/BookingWidget";
import { mockDoctors } from "../../data/mockDoctors";

export function DoctorProfilePage() {
  const { doctorId } = useParams();

  const doctor = mockDoctors.find((item) => item.id === doctorId);

  if (!doctor) {
    return (
      <div className="min-h-screen bg-offwhite">
        <Navbar />

        <main className="mx-auto max-w-7xl px-6 py-16">
          <h1 className="font-heading text-4xl font-bold text-navy">
            Doctor not found
          </h1>

          <Link
            to="/"
            className="mt-4 inline-block text-sm font-medium text-gold hover:text-gold-light"
          >
            Back to home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <Link
          to="/"
          className="text-sm font-medium text-navy-mid hover:text-gold"
        >
          ← Back to results
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gold-tint font-heading text-3xl font-bold text-navy">
                  {doctor.initials}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-heading text-4xl font-bold text-navy">
                      {doctor.fullName}
                    </h1>

                    {doctor.verified && (
                      <span className="rounded-sm bg-green-50 px-2 py-1 text-xs font-medium text-success">
                        ✓ Verified
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-lg text-navy-mid">
                    {doctor.title} — {doctor.organizationName}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-navy-mid">
                    <span className="text-gold">★★★★★ {doctor.rating}</span>
                    <span>({doctor.reviewsCount} reviews)</span>
                    <span>{doctor.experienceYears} years exp.</span>
                    <span>{doctor.languages.join(" · ")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <h2 className="font-heading text-2xl font-bold text-navy">
                About
              </h2>

              <p className="mt-3 leading-7 text-navy-mid">{doctor.bio}</p>
            </div>

            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <h2 className="font-heading text-2xl font-bold text-navy">
                Clinic Locations
              </h2>

              <div className="mt-4 space-y-4">
                {doctor.clinicLocations.map((clinic) => (
                  <div
                    key={clinic.id}
                    className="rounded-md border border-border p-4"
                  >
                    <p className="font-medium text-navy">{clinic.name}</p>

                    <p className="mt-1 text-sm text-navy-mid">
                      {clinic.address} — 📞 {clinic.phone}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <h2 className="font-heading text-2xl font-bold text-navy">
                Accepted Insurance
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {doctor.acceptedInsurance.map((insurance) => (
                  <span
                    key={insurance}
                    className="rounded-sm bg-gold-tint px-3 py-1 text-sm font-medium text-navy"
                  >
                    {insurance}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <BookingWidget doctor={doctor} />
        </div>
      </main>
    </div>
  );
}
