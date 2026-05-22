import {
  updateUI,
  markDone,
  markCurrentDone,
  markNoShow,
  restore,
  callNextPatient,
  addWalkIn,
  changeConsultTime,
  initDateLabel,
} from "./app.js";

// Initialize the application
function init() {
  initDateLabel();
  updateUI();
  setupEventListeners();
}

function setupEventListeners() {
  document
    .getElementById("call-next-btn")
    .addEventListener("click", callNextPatient);

  // Make functions available globally for onclick attributes
  window.markDone = markDone;
  window.markCurrentDone = markCurrentDone;
  window.markNoShow = markNoShow;
  window.restore = restore;
  window.addWalkIn = addWalkIn;
  window.changeConsultTime = changeConsultTime;
}

// Start the app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
