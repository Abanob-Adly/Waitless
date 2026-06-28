import { Link } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { Button } from "../../components/ui/Button";
import { mockDoctorSessions } from "../../data/mockDoctorSessions";

const mockTransactions = [
  { id: "t1", patient: "Ahmed Hassan", amount: 300, date: "2026-06-28", status: "paid" as const },
  { id: "t2", patient: "Sara Mohamed", amount: 300, date: "2026-06-28", status: "paid" as const },
  { id: "t3", patient: "Omar Ali", amount: 300, date: "2026-06-27", status: "pending" as const },
  { id: "t4", patient: "Nadia Karim", amount: 300, date: "2026-06-27", status: "paid" as const },
  { id: "t5", patient: "Youssef Ibrahim", amount: 300, date: "2026-06-26", status: "paid" as const },
];

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
          <h2 className="font-heading text-2xl font-bold text-navy">Wallet</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-offwhite p-4 text-center">
              <p className="text-xs text-navy-mid">Total Balance</p>
              <p className="mt-1 font-heading text-2xl font-bold text-navy">18,750 EGP</p>
            </div>
            <div className="rounded-xl border border-gold/30 bg-gold-tint p-4 text-center">
              <p className="text-xs text-navy-mid">This Month</p>
              <p className="mt-1 font-heading text-2xl font-bold text-gold">4,500 EGP</p>
            </div>
            <div className="rounded-xl border border-border bg-offwhite p-4 text-center">
              <p className="text-xs text-navy-mid">Pending</p>
              <p className="mt-1 font-heading text-2xl font-bold text-navy-mid">600 EGP</p>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-navy">Recent Transactions</h3>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {mockTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-navy">{tx.patient}</p>
                    <p className="text-xs text-navy-mid">{tx.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-navy">+{tx.amount} EGP</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      tx.status === "paid" ? "bg-success/10 text-success" : "bg-gold-tint text-gold"
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
