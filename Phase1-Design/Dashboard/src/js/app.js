import {
  state,
  getWaitingCount,
  getDoneCount,
  getNoShowCount,
  getTotalCount,
  getInSessionPatient,
  getWaitingPatients,
  getPatientById,
  addPatient,
  recalculateWaits,
} from "./state.js";
import {
  statusBadge,
  actionBtn,
  numColor,
  walkInBadge,
  walkInBadgeCompact,
} from "./render.js";


let toastTimer;

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

export function updateUI() {
  renderPatientTable();
  renderSidebarQueue();
  updateStats();
  updateInSessionBanner();
}

function renderPatientTable() {
  const tbody = document.getElementById("patient-table-body");
  tbody.innerHTML = state.patients
    .map(function (p)
    {
      var color;
      if(p.wait !== 'Now')
        color = 'black';
      else
        color = 'our-green font-bold';
    
      return `<tr class="transition-colors duration-150 hover:bg-gold-tint border-b border-b-gray">
        <td class="px-5  py-3.5">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 ${numColor(p)}">${p.id}</span>
        </td>
        <td class="px-4 py-3.5">
          <div class="font-medium text-navy flex items-center gap-2">
            ${p.name}
            ${p.walkin ? walkInBadge() : ""}
          </div>
          <div class="text-xs text-txt-gray">${p.type}</div>
        </td>
        <td class="px-4 py-3.5 text-txt-gray">${p.phone ?? "—"}</td>
        <td class="px-4 py-3.5 text-txt-gray">${p.joined}</td>
        <td class="px-4 py-3.5 text-${color} font-medium">${p.wait}</td>
        <td class="px-4 py-3.5">${statusBadge(p.status)}</td>
        <td class="px-4 py-3.5">${actionBtn(p)}</td>
      </tr>`
    }).join("");
}

function renderSidebarQueue() {
  const queue = getWaitingPatients();
  const sidebar = document.getElementById("sidebar-queue");
  sidebar.innerHTML = queue.length
    ? queue
        .map(
          (p) => `
      <div class="flex items-center gap-2.5 pb-3 border border-b-gray-700">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 bg-white/10 text-white/70">${p.id}</span>
        <span class="text-sm text-white/80 font-medium">${p.name}</span>
        ${p.walkin ? walkInBadgeCompact() : ""}
      </div>
    `
        )
        .join("")
    : `<p class="text-white/30 text-sm">No patients waiting</p>`;
}

function updateStats() {
  document.getElementById("stat-waiting").textContent = getWaitingCount();
  document.getElementById("stat-done").textContent = getDoneCount();
  document.getElementById("stat-noshow").textContent = getNoShowCount();
  document.getElementById("stat-total").textContent = getTotalCount();
}

function updateInSessionBanner() {
  const inSession = getInSessionPatient();
  const banner = document.getElementById("in-session-banner");
  if (inSession) {
    banner.style.display = "";
    document.getElementById("session-name").textContent = inSession.name;
  } else {
    banner.style.display = "none";
  }
}

export function markDone(id) {
  const patient = getPatientById(id);
  if (!patient) return;
  patient.status = "done";
  patient.wait = "—";
  showToast(`✓ ${patient.name} marked as done`);
  recalculateWaits();
  updateUI();
}

export function markCurrentDone() {
  const inSession = getInSessionPatient();
  if (inSession) markDone(inSession.id);
}

export function markNoShow(id) {
  const patient = getPatientById(id);
  if (!patient) return;
  patient.status = "noshow";
  patient.wait = "—";
  showToast(`${patient.name} marked as No Show`);
  recalculateWaits();
  updateUI();
}

export function restore(id) {
  const patient = getPatientById(id);
  if (!patient) return;
  patient.status = "waiting";
  showToast(`${patient.name} restored to queue`);
  recalculateWaits();
  updateUI();
}

export function callNextPatient() {
  const inSession = getInSessionPatient();
  if (inSession) {
    markDone(inSession.id);
  }
  const next = getWaitingPatients()[0];
  if (next) {
    next.status = "in-session";
    next.wait = "Now";
    showToast(`📞 Calling ${next.name}`);
    recalculateWaits();
    updateUI();
  } else {
    showToast("No patients in the waiting queue");
  }
}

export function addWalkIn() {
  const nameInput = document.getElementById("walkin-name");
  const phoneInput = document.getElementById("walkin-phone");
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name) {
    showToast("Please enter patient name");
    return;
  }

  const maxId = state.patients.reduce((m, p) => Math.max(m, p.id), 0);
  const now = new Date();
  const joined = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  addPatient({
    id: maxId + 1,
    name,
    type: "Added by receptionist",
    phone: phone || null,
    joined,
    wait: "—",
    status: "waiting",
    walkin: true,
  });

  nameInput.value = "";
  phoneInput.value = "";
  showToast(`${name} added to queue`);
  recalculateWaits();
  updateUI();
}

export function changeConsultTime(delta) {
  state.consultMin = Math.max(1, state.consultMin + delta);
  document.getElementById(
    "consult-time"
  ).textContent = `${state.consultMin} min`;
  recalculateWaits();
  updateUI();
}

// Initialize date label
export function initDateLabel() {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const now = new Date();
  document.getElementById("today-label").textContent = `Today, ${
    months[now.getMonth()]
  } ${now.getDate()}`;
}
