// Status badge rendering
export function statusBadge(status) {
  switch (status) {
    case "in-session":
      return `<span class="text-xs font-semibold text-emerald-600">In Session</span>`;
    case "waiting":
      return `<span class="flex items-center gap-1 text-xs font-semibold text-amber-500">
        <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>Waiting
      </span>`;
    case "noshow":
      return `<span class="text-xs font-semibold text-red-500">No Show</span>`;
    case "done":
      return `<span class="text-xs font-semibold text-emerald-500">Done</span>`;
    default:
      return "";
  }
}

// Action button rendering
export function actionBtn(patient) {
  if (patient.status === "in-session")
    return `<button onclick="markDone(${patient.id})"
      class="border border-gray-200 text-xs font-semibold text-navy px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Done ✓</button>`;
  if (patient.status === "waiting")
    return `<button onclick="markNoShow(${patient.id})"
      class="border border-gray-200 text-xs font-medium text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">No Show</button>`;
  if (patient.status === "noshow")
    return `<button onclick="restore(${patient.id})"
      class="border border-gray-200 text-xs font-medium text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Restore</button>`;
  return "";
}

// Queue badge color class
export function numColor(patient) {
  if (patient.status === "in-session") return "text-white bg-gold";
  if (patient.status === "noshow") return "text-red-400 bg-red-50";
  return "text-gray-400 bg-gray-100";
}

// Render walk-in badge
export function walkInBadge() {
  return `<span class="text-xs font-semibold bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">Walk-in</span>`;
}

export function walkInBadgeCompact() {
  return `<span class="text-xs bg-sky-500/20 text-sky-300 font-semibold px-1.5 py-0.5 rounded-full">W</span>`;
}
