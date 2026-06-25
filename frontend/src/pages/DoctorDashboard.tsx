import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchDoctorQueue, fetchSessions, markPatientServed, skipPatient, markNoShow } from "../services/mockApi";
import type { QueuePatient } from "../services/mockApi";
import { Tabs } from "../components/ui/Tabs";
import type { Session } from "../context/AppContext";

// ── Page ──────────────────────────────────────────────────────────────────────

export function DoctorDashboard() {
  const { authUser, logout } = useAuth();
  const navigate = useNavigate();

  if (!authUser || authUser.role !== "doctor") {
    navigate("/login", { replace: true });
    return null;
  }

  const doctor = authUser.profile;

  const tabs = [
    {
      id: "queue",
      label: "Today's Queue",
      content: <QueueTab doctorId={doctor.id} />,
    },
    {
      id: "sessions",
      label: "My Sessions",
      content: <SessionsTab doctorId={doctor.id} />,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Page heading */}
      <div className="mb-8 flex animate-fade-up items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gold">Doctor Portal</p>
          <h1 className="font-heading text-4xl font-bold text-navy">
            Welcome, {doctor.name}
          </h1>
          <p className="mt-1 text-sm text-navy-mid">
            {doctor.specialty} · License {doctor.licenseNumber}
          </p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="rounded-md border border-border px-4 py-2 text-sm text-navy-mid transition hover:border-danger/40 hover:text-danger"
        >
          Sign Out
        </button>
      </div>

      <section className="animate-fade-up rounded-xl border border-border bg-white p-6 shadow-sm" style={{ animationDelay: "100ms" }}>
        <Tabs items={tabs} defaultTab="queue" />
      </section>
    </main>
  );
}

// ── Today's Queue tab ─────────────────────────────────────────────────────────

function QueueTab({ doctorId, avgConsultationMin = 10 }: { doctorId: string; avgConsultationMin?: number }) {
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function poll() {
      const data = await fetchDoctorQueue(doctorId);
      if (!alive) return;
      setQueue(data);
      setIsLoading(false);
    }

    poll();
    // Refresh every 8 seconds so doctor queue reflects patient-side advances
    const id = setInterval(poll, 8_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [doctorId]);

  async function handleMarkServed(patient: QueuePatient) {
    await markPatientServed(patient.id, doctorId, avgConsultationMin);
    setQueue((prev) =>
      prev.map((p) =>
        p.id === patient.id ? { ...p, status: "done" } : p,
      ),
    );
  }

  async function handleCallNext() {
    const waiting = queue.find((p) => p.status === "waiting");
    if (!waiting) return;
    await markPatientServed(waiting.id, doctorId, avgConsultationMin);
    setQueue((prev) =>
      prev.map((p) => {
        if (p.id === waiting.id) return { ...p, status: "serving" };
        if (p.status === "serving") return { ...p, status: "done" };
        return p;
      }),
    );
  }

  async function handleSkip(patient: QueuePatient) {
    await skipPatient(patient.id, doctorId);
    setQueue((prev) => prev.map((p) => p.id === patient.id ? { ...p, status: "skipped" } : p));
  }

  async function handleNoShow(patient: QueuePatient) {
    await markNoShow(patient.id, doctorId);
    setQueue((prev) => prev.map((p) => p.id === patient.id ? { ...p, status: "no_show" } : p));
  }

  const serving = queue.find((p) => p.status === "serving");
  const waitingCount = queue.filter((p) => p.status === "waiting").length;
  const doneCount = queue.filter((p) => p.status === "done").length;

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-offwhite" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          <StatBox key="total" label="Total Patients" value={queue.length.toString()} />,
          <StatBox key="waiting" label="Waiting" value={waitingCount.toString()} accent />,
          <StatBox key="done" label="Completed" value={doneCount.toString()} success />,
        ].map((box, i) => (
          <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            {box}
          </div>
        ))}
      </div>

      {/* Currently serving banner */}
      {serving && (
        <div className="flex items-center justify-between rounded-xl border border-gold bg-gold-tint px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Now Serving
            </p>
            <p className="mt-0.5 font-heading text-xl font-bold text-navy">
              #{serving.queueNumber} — {serving.displayName}
            </p>
            <p className="text-xs text-navy-mid">
              Arrived at {serving.arrivalTime}
            </p>
          </div>
          <button
            onClick={() => handleMarkServed(serving)}
            className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-mid"
          >
            Mark Served ✓
          </button>
        </div>
      )}

      {/* Call next button */}
      {waitingCount > 0 && !serving && (
        <button
          onClick={handleCallNext}
          className="h-12 w-full rounded-md bg-gold text-base font-medium text-navy transition hover:bg-gold-light"
        >
          Call Next Patient →
        </button>
      )}

      {/* Queue list */}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {queue.map((patient) => (
          <QueueRow
            key={patient.id}
            patient={patient}
            onMarkServed={() => handleMarkServed(patient)}
            onSkip={() => handleSkip(patient)}
            onNoShow={() => handleNoShow(patient)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Sessions tab ──────────────────────────────────────────────────────────────

function SessionsTab({ doctorId }: { doctorId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSessions(doctorId).then((data) => {
      setSessions(data);
      setIsLoading(false);
    });
  }, [doctorId]);

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-offwhite" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl bg-offwhite py-12 text-center">
        <p className="text-4xl">📅</p>
        <p className="mt-3 font-heading text-lg font-bold text-navy">
          No sessions scheduled
        </p>
        <p className="mt-1 text-sm text-navy-mid">
          Contact your clinic administrator to schedule sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between px-5 py-4"
        >
          <div>
            <p className="font-medium text-navy">{session.date}</p>
            <p className="mt-0.5 text-sm text-navy-mid">
              {session.startTime} – {session.endTime} · {session.clinicName}
            </p>
          </div>
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-success">
            {session.availableSlots} slots open
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QueueRow({
  patient,
  onMarkServed,
  onSkip,
  onNoShow,
}: {
  patient: QueuePatient;
  onMarkServed: () => void;
  onSkip: () => void;
  onNoShow: () => void;
}) {
  const statusStyles: Record<QueuePatient["status"], string> = {
    waiting:  "bg-gold-tint text-navy",
    serving:  "bg-success/10 text-success",
    done:     "bg-border/50 text-navy-mid",
    skipped:  "bg-orange-50 text-orange-600",
    no_show:  "bg-danger/10 text-danger",
  };
  const statusLabel: Record<QueuePatient["status"], string> = {
    waiting:  "Waiting",
    serving:  "Serving",
    done:     "Done ✓",
    skipped:  "Skipped",
    no_show:  "No-Show",
  };

  const isDone = patient.status === "done" || patient.status === "skipped" || patient.status === "no_show";

  return (
    <div
      className={`flex items-center justify-between px-5 py-3.5 ${
        isDone ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-sm font-bold text-white">
          {patient.queueNumber}
        </span>
        <div>
          <p className="text-sm font-medium text-navy">{patient.displayName}</p>
          <p className="text-xs text-navy-mid">
            Arrived {patient.arrivalTime}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[patient.status]}`}
        >
          {statusLabel[patient.status]}
        </span>
        {patient.status === "waiting" && (
          <>
            <button
              onClick={onSkip}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-navy-mid transition hover:border-navy hover:text-navy"
            >
              Skip
            </button>
            <button
              onClick={onNoShow}
              className="rounded-md border border-danger/30 px-3 py-1.5 text-xs text-danger transition hover:bg-danger/5"
            >
              No-Show
            </button>
            <button
              onClick={onMarkServed}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-navy-mid transition hover:border-success hover:bg-success/5 hover:text-success"
            >
              Mark Served
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent = false,
  success = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  success?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 text-center">
      <p
        className={`font-heading text-3xl font-bold ${
          accent ? "text-gold" : success ? "text-success" : "text-navy"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-navy-mid">{label}</p>
    </div>
  );
}
