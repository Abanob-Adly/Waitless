import { useMemo, useState } from "react";
import type { AppointmentStatus, QueueAppointment } from "../types/appointment";
import type { SessionStatus } from "../types/session";

type UseDoctorQueueParams = {
  initialSessionStatus: SessionStatus;
  initialAppointments: QueueAppointment[];
};

type AddWalkInPatientInput = {
  patientName: string;
  phone?: string;
};

function getCurrentTimeLabel() {
  const now = new Date();

  return now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function useDoctorQueue({
  initialSessionStatus,
  initialAppointments,
}: UseDoctorQueueParams) {
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>(initialSessionStatus);

  const [appointments, setAppointments] =
    useState<QueueAppointment[]>(initialAppointments);

  const activeAppointment = useMemo(() => {
    return appointments.find(
      (appointment) =>
        appointment.status === "called" || appointment.status === "in_progress",
    );
  }, [appointments]);

  const waitingAppointments = useMemo(() => {
    return appointments
      .filter((appointment) => appointment.status === "booked")
      .sort((a, b) => a.queueNumber - b.queueNumber);
  }, [appointments]);

  const completedAppointments = useMemo(() => {
    return appointments.filter(
      (appointment) => appointment.status === "completed",
    );
  }, [appointments]);

  const noShowAppointments = useMemo(() => {
    return appointments.filter(
      (appointment) => appointment.status === "no_show",
    );
  }, [appointments]);

  const cancelledAppointments = useMemo(() => {
    return appointments.filter(
      (appointment) => appointment.status === "cancelled",
    );
  }, [appointments]);

  const stats = useMemo(() => {
    return {
      waiting: waitingAppointments.length,
      completed: completedAppointments.length,
      noShows: noShowAppointments.length,
      cancelled: cancelledAppointments.length,
      total: appointments.length,
    };
  }, [
    appointments.length,
    waitingAppointments.length,
    completedAppointments.length,
    noShowAppointments.length,
    cancelledAppointments.length,
  ]);

  const currentServing = useMemo(() => {
    return activeAppointment?.queueNumber ?? 0;
  }, [activeAppointment]);

  function updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus,
  ) {
    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              status,
            }
          : appointment,
      ),
    );
  }

  function getNextWaitingAppointment(currentAppointments: QueueAppointment[]) {
    return currentAppointments
      .filter((appointment) => appointment.status === "booked")
      .sort((a, b) => a.queueNumber - b.queueNumber)[0];
  }

  function startSession() {
    if (sessionStatus !== "scheduled") return;

    setSessionStatus("active");

    setAppointments((currentAppointments) => {
      const hasActiveAppointment = currentAppointments.some(
        (appointment) =>
          appointment.status === "called" ||
          appointment.status === "in_progress",
      );

      if (hasActiveAppointment) return currentAppointments;

      const nextAppointment = getNextWaitingAppointment(currentAppointments);

      if (!nextAppointment) return currentAppointments;

      return currentAppointments.map((appointment) =>
        appointment.id === nextAppointment.id
          ? {
              ...appointment,
              status: "called",
            }
          : appointment,
      );
    });
  }

  function callNext() {
    if (sessionStatus !== "active") return;

    setAppointments((currentAppointments) => {
      const hasActiveAppointment = currentAppointments.some(
        (appointment) =>
          appointment.status === "called" ||
          appointment.status === "in_progress",
      );

      if (hasActiveAppointment) return currentAppointments;

      const nextAppointment = getNextWaitingAppointment(currentAppointments);

      if (!nextAppointment) return currentAppointments;

      return currentAppointments.map((appointment) =>
        appointment.id === nextAppointment.id
          ? {
              ...appointment,
              status: "called",
            }
          : appointment,
      );
    });
  }

  function startConsultation(appointmentId: string) {
    if (sessionStatus !== "active") return;

    updateAppointmentStatus(appointmentId, "in_progress");
  }

  function markDone(appointmentId: string) {
    if (sessionStatus !== "active") return;

    setAppointments((currentAppointments) => {
      const updatedAppointments = currentAppointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              status: "completed" as AppointmentStatus,
            }
          : appointment,
      );

      const nextAppointment = getNextWaitingAppointment(updatedAppointments);

      if (!nextAppointment) return updatedAppointments;

      return updatedAppointments.map((appointment) =>
        appointment.id === nextAppointment.id
          ? {
              ...appointment,
              status: "called" as AppointmentStatus,
            }
          : appointment,
      );
    });
  }

  function markNoShow(appointmentId: string) {
    if (sessionStatus !== "active") return;

    setAppointments((currentAppointments) => {
      const updatedAppointments = currentAppointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              status: "no_show" as AppointmentStatus,
            }
          : appointment,
      );

      const nextAppointment = getNextWaitingAppointment(updatedAppointments);

      if (!nextAppointment) return updatedAppointments;

      return updatedAppointments.map((appointment) =>
        appointment.id === nextAppointment.id
          ? {
              ...appointment,
              status: "called" as AppointmentStatus,
            }
          : appointment,
      );
    });
  }

  function cancelAppointment(appointmentId: string) {
    updateAppointmentStatus(appointmentId, "cancelled");
  }

  function addWalkInPatient(input: AddWalkInPatientInput) {
    const trimmedName = input.patientName.trim();
    const trimmedPhone = input.phone?.trim();

    if (!trimmedName) return;

    setAppointments((currentAppointments) => {
      const maxQueueNumber = currentAppointments.reduce(
        (max, appointment) => Math.max(max, appointment.queueNumber),
        0,
      );

      const queueNumber = maxQueueNumber + 1;

      const estimatedWaitMin = Math.max(0, waitingAppointments.length * 12);

      const newAppointment: QueueAppointment = {
        id: `walkin-${Date.now()}`,
        queueNumber,
        patientName: trimmedName,
        phone: trimmedPhone || undefined,
        source: "walk_in",
        joinedAt: getCurrentTimeLabel(),
        estimatedWaitMin,
        status: "booked",
      };

      return [...currentAppointments, newAppointment];
    });
  }

  function endSession() {
    if (sessionStatus !== "active") return;

    setSessionStatus("ended");

    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) => {
        if (
          appointment.status === "booked" ||
          appointment.status === "called" ||
          appointment.status === "in_progress"
        ) {
          return {
            ...appointment,
            status: "cancelled",
          };
        }

        return appointment;
      }),
    );
  }

  return {
    sessionStatus,
    appointments,

    activeAppointment,
    waitingAppointments,
    completedAppointments,
    noShowAppointments,
    cancelledAppointments,

    stats,
    currentServing,

    startSession,
    callNext,
    startConsultation,
    markDone,
    markNoShow,
    cancelAppointment,
    addWalkInPatient,
    endSession,
  };
}
