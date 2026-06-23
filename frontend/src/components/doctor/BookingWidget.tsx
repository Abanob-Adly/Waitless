import { Link } from "react-router-dom";
import type { Doctor } from "../../types/doctor";
import { Button } from "../ui/Button";

type BookingWidgetProps = {
  doctor: Doctor;
};

export function BookingWidget({ doctor }: BookingWidgetProps) {
  return (
    <aside className="h-fit rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="font-heading text-2xl font-bold text-navy">
        Book appointment
      </h2>

      <p className="mt-2 text-sm text-navy-mid">
        Choose your preferred clinic, date, and time.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-navy">Clinic</span>

          <select className="mt-2 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold">
            {doctor.clinicLocations.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-navy">Date</span>

          <input
            type="date"
            className="mt-2 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-navy">Time</span>

          <select className="mt-2 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm text-navy outline-none transition focus:border-gold">
            <option value="09:30">09:30 AM</option>
            <option value="10:00">10:00 AM</option>
            <option value="10:30">10:30 AM</option>
            <option value="11:00">11:00 AM</option>
          </select>
        </label>
      </div>

      <div className="mt-6 rounded-md bg-gold-tint p-4">
        <p className="text-sm text-navy-mid">Consultation fee</p>

        <p className="mt-1 font-heading text-3xl font-bold text-gold">
          {doctor.consultationFee}
          <span className="ml-1 font-body text-sm font-medium text-navy-mid">
            EGP
          </span>
        </p>
      </div>

      <Link to="/payment" className="mt-5 block">
        <Button size="lg" className="w-full">
          Book Appointment
        </Button>
      </Link>
    </aside>
  );
}
