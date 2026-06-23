import { Link } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { Button } from "../../components/ui/Button";
import { mockDoctorSessions } from "../../data/mockDoctorSessions";

export function DoctorDashboardPage() {
  const todaySession = mockDoctorSessions[0];

  return (
    <div className="min-h-screen bg-offwhite">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-gold">Doctor Dashboard</p>

            <h1 className="mt-2 font-heading text-4xl font-bold text-navy">
              Welcome back, {todaySession.doctorName}
            </h1>

            <p className="mt-2 text-navy-mid">
              Manage today&apos;s sessions, follow the queue, and update your
              profile.
            </p>
          </div>

          <Link to="/doctor/profile">
            <Button variant="outline">Edit Profile</Button>
          </Link>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard
            label="Today's Patients"
            value={todaySession.bookingsCount.toString()}
          />
          <StatCard
            label="Current Serving"
            value={`#${todaySession.currentServing}`}
          />
          <StatCard
            label="Avg. Consultation"
            value={`${todaySession.avgConsultationMin} min`}
          />
          <StatCard label="Session Status" value={todaySession.status} />
        </section>

        <section className="mt-8 rounded-lg border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="font-heading text-2xl font-bold text-navy">
                Today&apos;s Session
              </h2>

              <p className="mt-1 text-sm text-navy-mid">
                {todaySession.clinicName} · {todaySession.branchName}
              </p>

              <p className="mt-1 text-sm text-navy-mid">
                {todaySession.date} · {todaySession.startTime} -{" "}
                {todaySession.endTime}
              </p>
            </div>

            <Link to={`/doctor/sessions/${todaySession.id}/queue`}>
              <Button>Open Queue</Button>
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-bold text-navy">
              Upcoming Sessions
            </h2>

            <Link
              to="/doctor/sessions"
              className="text-sm font-medium text-gold hover:text-gold-light"
            >
              View all →
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {mockDoctorSessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col justify-between gap-4 rounded-md border border-border p-4 md:flex-row md:items-center"
              >
                <div>
                  <p className="font-medium text-navy">{session.clinicName}</p>

                  <p className="mt-1 text-sm text-navy-mid">
                    {session.date} · {session.startTime} - {session.endTime}
                  </p>
                </div>

                <Link to={`/doctor/sessions/${session.id}/queue`}>
                  <Button size="sm" variant="outline">
                    View Queue
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <p className="text-sm text-navy-mid">{label}</p>
      <p className="mt-2 font-heading text-3xl font-bold capitalize text-navy">
        {value}
      </p>
    </div>
  );
}
