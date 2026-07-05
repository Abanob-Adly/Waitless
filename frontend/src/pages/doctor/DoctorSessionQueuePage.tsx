import { Link, useParams } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { Button } from "../../components/ui/Button";
import { mockDoctorSessions } from "../../data/mockDoctorSessions";
import { mockAppointments } from "../../data/mockAppointments";
import { useDoctorQueue } from "../../hooks/useDoctorQueue";
import type { AppointmentStatus } from "../../types/appointment";
import type { SessionStatus } from "../../types/session";
import { useLanguage } from "../../context/LanguageContext";
import { fmt12 } from "../../utils/time";

export function DoctorSessionQueuePage() {
  const { sessionId } = useParams();
  const { locale } = useLanguage();

  const session = mockDoctorSessions.find((item) => item.id === sessionId);

  const {
    sessionStatus,
    appointments,
    activeAppointment,
    waitingAppointments,
    stats,
    currentServing,
    startSession,
    callNext,
    startConsultation,
    markDone,
    markNoShow,
    endSession,
  } = useDoctorQueue({
    initialSessionStatus: session?.status ?? "scheduled",
    initialAppointments: mockAppointments,
  });

  if (!session) {
    return (
      <div className="min-h-screen bg-offwhite">
        <Navbar />

        <main className="mx-auto max-w-7xl px-6 py-16">
          <h1 className="font-heading text-4xl font-bold text-navy">
            Session not found
          </h1>

          <Link
            to="/doctor/dashboard"
            className="mt-4 inline-block text-sm font-medium text-gold hover:text-gold-light"
          >
            Back to dashboard
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
          to="/doctor/dashboard"
          className="text-sm font-medium text-navy-mid hover:text-gold"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-medium text-gold">Doctor Queue</p>

            <h1 className="mt-2 font-heading text-4xl font-bold text-navy">
              {session.doctorName}
            </h1>

            <p className="mt-2 text-navy-mid">
              {session.specialty} · {session.clinicName} · {session.branchName}
            </p>

            <p className="mt-1 text-sm text-navy-mid">
              {session.date} · {fmt12(session.startTime, locale)} - {fmt12(session.endTime, locale)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {sessionStatus === "scheduled" && (
              <Button onClick={startSession}>Start Session</Button>
            )}

            {sessionStatus === "active" && (
              <>
                <Button
                  variant="outline"
                  onClick={callNext}
                  disabled={Boolean(activeAppointment)}
                >
                  Call Next
                </Button>

                <Button variant="secondary" onClick={endSession}>
                  End Session
                </Button>
              </>
            )}

            {sessionStatus === "ended" && (
              <span className="rounded-sm bg-gold-tint px-3 py-2 text-sm font-medium text-navy">
                Session ended
              </span>
            )}
          </div>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-5">
          <StatCard label="Waiting" value={stats.waiting.toString()} />
          <StatCard label="Completed" value={stats.completed.toString()} />
          <StatCard label="No Shows" value={stats.noShows.toString()} />
          <StatCard label="Cancelled" value={stats.cancelled.toString()} />
          <StatCard label="Total Today" value={stats.total.toString()} />
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
          <aside className="h-fit rounded-lg border border-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl font-bold text-navy">
                Current Patient
              </h2>

              <SessionStatusBadge status={sessionStatus} />
            </div>

            {activeAppointment ? (
              <div className="mt-6">
                <div className="rounded-lg bg-navy p-5 text-white">
                  <p className="text-sm text-white/60">
                    Now serving queue number
                  </p>

                  <p className="mt-2 font-heading text-6xl font-bold text-gold">
                    #{activeAppointment.queueNumber}
                  </p>

                  <h3 className="mt-4 font-heading text-2xl font-bold">
                    {activeAppointment.patientName}
                  </h3>

                  <p className="mt-1 text-sm text-white/70">
                    {activeAppointment.phone ?? "No phone provided"}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <SourceBadge source={activeAppointment.source} />
                    <AppointmentStatusBadge status={activeAppointment.status} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {activeAppointment.status === "called" && (
                    <Button
                      className="w-full"
                      onClick={() => startConsultation(activeAppointment.id)}
                    >
                      Start Consultation
                    </Button>
                  )}

                  {activeAppointment.status === "in_progress" && (
                    <Button
                      className="w-full"
                      onClick={() => markDone(activeAppointment.id)}
                    >
                      Mark Done
                    </Button>
                  )}

                  {(activeAppointment.status === "called" ||
                    activeAppointment.status === "in_progress") && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => markNoShow(activeAppointment.id)}
                    >
                      Mark No Show
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-md border border-border bg-offwhite p-5">
                <p className="font-medium text-navy">
                  No patient currently active
                </p>

                <p className="mt-2 text-sm leading-6 text-navy-mid">
                  Start the session or call the next patient when ready.
                </p>

                {sessionStatus === "active" &&
                  waitingAppointments.length > 0 && (
                    <Button className="mt-5 w-full" onClick={callNext}>
                      Call Next Patient
                    </Button>
                  )}
              </div>
            )}

            <div className="mt-6 rounded-md bg-gold-tint p-4">
              <p className="text-sm text-navy-mid">Current serving</p>

              <p className="mt-1 font-heading text-3xl font-bold text-gold">
                #{currentServing}
              </p>

              <p className="mt-1 text-xs text-navy-mid">
                Avg consultation: {session.avgConsultationMin} min
              </p>
            </div>
          </aside>

          <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="font-heading text-2xl font-bold text-navy">
                  Today&apos;s Queue
                </h2>

                <p className="mt-1 text-sm text-navy-mid">
                  Manage booked and walk-in patients for this session.
                </p>
              </div>

              <Button variant="outline">+ Add Walk-in</Button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-850px border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-navy-mid">
                    <th className="py-3 pr-4">#</th>
                    <th className="py-3 pr-4">Patient</th>
                    <th className="py-3 pr-4">Phone</th>
                    <th className="py-3 pr-4">Source</th>
                    <th className="py-3 pr-4">Joined</th>
                    <th className="py-3 pr-4">Est. wait</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {appointments
                    .slice()
                    .sort((a, b) => a.queueNumber - b.queueNumber)
                    .map((appointment) => (
                      <tr
                        key={appointment.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-4 pr-4 font-medium text-navy">
                          {appointment.queueNumber}
                        </td>

                        <td className="py-4 pr-4">
                          <p className="font-medium text-navy">
                            {appointment.patientName}
                          </p>
                        </td>

                        <td className="py-4 pr-4 text-sm text-navy-mid">
                          {appointment.phone ?? "—"}
                        </td>

                        <td className="py-4 pr-4">
                          <SourceBadge source={appointment.source} />
                        </td>

                        <td className="py-4 pr-4 text-sm text-navy-mid">
                          {appointment.joinedAt}
                        </td>

                        <td className="py-4 pr-4 text-sm text-navy-mid">
                          {appointment.estimatedWaitMin === 0
                            ? "Now"
                            : `~${appointment.estimatedWaitMin}m`}
                        </td>

                        <td className="py-4 pr-4">
                          <AppointmentStatusBadge status={appointment.status} />
                        </td>

                        <td className="py-4 pr-4">
                          <div className="flex justify-end gap-2">
                            {appointment.status === "booked" &&
                              sessionStatus === "active" &&
                              !activeAppointment && (
                                <button
                                  type="button"
                                  onClick={callNext}
                                  className="rounded-sm bg-gold px-3 py-2 text-xs font-medium text-navy transition hover:bg-gold-light"
                                >
                                  Call
                                </button>
                              )}

                            {appointment.status === "called" && (
                              <button
                                type="button"
                                onClick={() =>
                                  startConsultation(appointment.id)
                                }
                                className="rounded-sm bg-navy px-3 py-2 text-xs font-medium text-white transition hover:bg-navy-mid"
                              >
                                Start
                              </button>
                            )}

                            {appointment.status === "in_progress" && (
                              <button
                                type="button"
                                onClick={() => markDone(appointment.id)}
                                className="rounded-sm bg-success px-3 py-2 text-xs font-medium text-white transition hover:opacity-90"
                              >
                                Done
                              </button>
                            )}

                            {(appointment.status === "booked" ||
                              appointment.status === "called") && (
                              <button
                                type="button"
                                onClick={() => markNoShow(appointment.id)}
                                className="rounded-sm border border-border px-3 py-2 text-xs font-medium text-navy-mid transition hover:border-gold hover:text-navy"
                              >
                                No Show
                              </button>
                            )}

                            {(appointment.status === "completed" ||
                              appointment.status === "no_show" ||
                              appointment.status === "cancelled") && (
                              <span className="text-xs text-navy-mid">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
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
      <p className="mt-2 font-heading text-3xl font-bold text-navy">{value}</p>
    </div>
  );
}

type SessionStatusBadgeProps = {
  status: SessionStatus;
};

function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const classes: Record<SessionStatus, string> = {
    scheduled: "bg-gold-tint text-navy",
    active: "bg-green-50 text-success",
    ended: "bg-navy text-white",
    cancelled: "bg-red-50 text-danger",
  };

  return (
    <span
      className={`rounded-sm px-2 py-1 text-xs font-medium capitalize ${classes[status]}`}
    >
      {status}
    </span>
  );
}

type AppointmentStatusBadgeProps = {
  status: AppointmentStatus;
};

function AppointmentStatusBadge({ status }: AppointmentStatusBadgeProps) {
  const label: Record<AppointmentStatus, string> = {
    booked: "Waiting",
    called: "Called",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No Show",
  };

  const classes: Record<AppointmentStatus, string> = {
    booked: "bg-gold-tint text-navy",
    called: "bg-blue-50 text-blue-700",
    in_progress: "bg-green-50 text-success",
    completed: "bg-navy text-white",
    cancelled: "bg-red-50 text-danger",
    no_show: "bg-red-50 text-danger",
  };

  return (
    <span
      className={`rounded-sm px-2 py-1 text-xs font-medium ${classes[status]}`}
    >
      {label[status]}
    </span>
  );
}

type SourceBadgeProps = {
  source: "marketplace" | "walk_in";
};

function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <span className="rounded-sm border border-border px-2 py-1 text-xs font-medium text-navy-mid">
      {source === "marketplace" ? "Online" : "Walk-in"}
    </span>
  );
}
