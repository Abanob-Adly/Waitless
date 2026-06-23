import { Navbar } from "../../components/layout/Navbar";
<<<<<<< HEAD
import { DoctorCard } from "../../components/doctors/DoctorCard";
=======
import { DoctorCard } from "../../components/doctor/DoctorCard";
>>>>>>> 7a83634e1ffa21b7db94c8ad5290d61944d50e3c
import { Button } from "../../components/ui/Button";
import { mockDoctors } from "../../data/mockDoctors";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-offwhite">
      <Navbar />

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-gold-tint px-4 py-2 text-sm font-medium text-navy">
              Egypt&apos;s #1 Healthcare Booking Platform
            </p>

            <h1 className="font-heading text-5xl font-bold leading-tight text-navy md:text-6xl">
              Book Your Doctor. Skip the Wait.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-navy-mid">
              Find, compare and book appointments with Egypt&apos;s top
              specialists — online, instantly, no phone calls.
            </p>

            <div className="mt-8 rounded-lg border border-border bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <select className="h-12 rounded-sm border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold">
                  <option>All Specialties</option>
                  <option>Cardiology</option>
                  <option>Dermatology</option>
                  <option>Pediatrics</option>
                </select>

                <select className="h-12 rounded-sm border border-border bg-white px-4 text-sm text-navy outline-none focus:border-gold">
                  <option>All Areas</option>
                  <option>Maadi</option>
                  <option>Heliopolis</option>
                  <option>New Cairo</option>
                </select>

                <Button size="lg">Search Doctors</Button>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-4">
              <Stat value="50K+" label="Patients Served" />
              <Stat value="1,200+" label="Verified Doctors" />
              <Stat value="98%" label="Satisfaction" />
              <Stat value="35+" label="Specialties" />
            </div>
          </div>

          <div className="rounded-lg bg-navy p-6 text-white shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Live queue preview</p>
                <h2 className="font-heading text-2xl font-bold">
                  Skip waiting rooms
                </h2>
              </div>

              <span className="rounded-full bg-success px-3 py-1 text-xs font-medium">
                Live
              </span>
            </div>

            <div className="rounded-lg bg-white p-5 text-navy">
              <p className="text-sm text-navy-mid">Your position in queue</p>
              <p className="mt-3 font-heading text-6xl font-bold text-gold">
                4
              </p>
              <p className="mt-2 text-sm text-navy-mid">
                Estimated wait: ~36 minutes
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-gold">Highly rated</p>
              <h2 className="font-heading text-4xl font-bold text-navy">
                Top Specialists
              </h2>
            </div>

            <a
              href="#"
              className="text-sm font-medium text-navy hover:text-gold"
            >
              View all →
            </a>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {mockDoctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

type StatProps = {
  value: string;
  label: string;
};

function Stat({ value, label }: StatProps) {
  return (
    <div>
      <p className="font-heading text-3xl font-bold text-gold">{value}</p>
      <p className="mt-1 text-sm text-navy-mid">{label}</p>
    </div>
  );
}
