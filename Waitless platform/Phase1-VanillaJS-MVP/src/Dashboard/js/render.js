// Status badge rendering
export function statusBadge(status) {
  switch (status) {
    case "in-session":
      return `<span class="text-xs font-semibold bg-green-400/10 text-cyan-800 rounded-2xl px-2 py-1 text-nowrap">In Session</span>`;
    case "waiting":
      return `<span class="flex items-center justify-center gap-1 w-fit text-xs font-semibold text-amber-500 rounded-2xl px-2 py-1 bg-amber-300/10">
        <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>Waiting
      </span>`;
    case "noshow":
      return `<span class="text-xs font-semibold px-2 py-1 rounded-2xl bg-red-400/10 text-our-red text-nowrap">No Show</span>`;
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
      class="border border-green-400/70 bg-green-300/10 text-xs font-semibold text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors wrap text-nowrap">Done ✓</button>`;
  if (patient.status === "waiting")
    return `<button onclick="markNoShow(${patient.id})"
      class="border border-b-gray bg-white text-xs font-medium text-our-red px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-nowrap">No Show</button>`;
  if (patient.status === "noshow")
    return `<button onclick="restore(${patient.id})"
      class="border border-b-gray bg-white text-xs font-medium text-black px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Restore</button>`;
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
  return `<span class="text-xs font-semibold bg-amber-100/20 text-our-red px-1.5 py-0.5 rounded-lg">Walk-in</span>`;
}

export function walkInBadgeCompact() {
  return `<span class="text-xs bg-sky-500/20 text-sky-300 font-semibold px-1.5 py-0.5 rounded-full">W</span>`;
}
