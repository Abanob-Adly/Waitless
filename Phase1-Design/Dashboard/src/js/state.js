// Patient state management
export const state = {
  consultMin: 12,
  patients: [
    {
      id: 1,
      name: "Ahmed Youssef",
      type: "Online booking",
      phone: "0100-123-4567",
      joined: "09:10",
      wait: "Now",
      status: "in-session",
    },
    {
      id: 2,
      name: "Nadia Karim",
      type: "Online booking",
      phone: "0101-987-6543",
      joined: "09:22",
      wait: "~12m",
      status: "waiting",
    },
    {
      id: 3,
      name: "Hassan Ali",
      type: "Added by receptionist",
      phone: "0102-555-1234",
      joined: "09:35",
      wait: "~24m",
      status: "waiting",
      walkin: true,
    },
    {
      id: 5,
      name: "Khaled Emad",
      type: "Online booking",
      phone: null,
      joined: "09:58",
      wait: "—",
      status: "noshow",
    },
  ],
};

export function getWaitingCount() {
  return state.patients.filter((p) => p.status === "waiting").length;
}

export function getDoneCount() {
  return state.patients.filter((p) => p.status === "done").length;
}

export function getNoShowCount() {
  return state.patients.filter((p) => p.status === "noshow").length;
}

export function getTotalCount() {
  return state.patients.length;
}

export function getInSessionPatient() {
  return state.patients.find((p) => p.status === "in-session");
}

export function getWaitingPatients() {
  return state.patients.filter((p) => p.status === "waiting");
}

export function getPatientById(id) {
  return state.patients.find((x) => x.id === id);
}

export function addPatient(patient) {
  state.patients.push(patient);
}

export function recalculateWaits() {
  let mins = 0;
  state.patients.forEach((p) => {
    if (p.status === "in-session") {
      p.wait = "Now";
    } else if (p.status === "waiting") {
      mins += state.consultMin;
      p.wait = `~${mins}m`;
    }
  });
}
