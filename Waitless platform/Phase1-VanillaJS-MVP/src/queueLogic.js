let queueState = {
  myNumber: 24,
  currentServing: 18,
  avgConsultationTime: 15,
};

// UI Adapter
const renderQueueUI = (state) => {
  const currentNumEl = document.getElementById("current-number");
  const waitTimeEl = document.getElementById("wait-time");

  if (!currentNumEl || !waitTimeEl) return;

  currentNumEl.textContent = state.currentServing;

  const waitTime = Math.max(
    0,
    (state.myNumber - state.currentServing - 1) * state.avgConsultationTime,
  );

  if (state.currentServing >= state.myNumber) {
    waitTime.textContent = "It's your turn";
    waitTimeEl.classList.remove("text-gold");
    waitTimeEl.classList.add("text-green-600", "font-bold");
  } else {
    waitTimeEl.textContent = `~${waitTime}m`;
  }
};

// 3. API/Backend Simulation
const fetchNextNumberFromDB = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      (resolve(queueState.currentServing + 1), 1000);
    });
  });
};

const initApp = async () => {
  renderQueueUI(queueState);

  const interval = setInterval(async () => {
    if (queueState.currentServing < queueState.myNumber) {
      const newServingNum = await fetchNextNumberFromDB(); 
      
      queueState.currentServing = newServingNum;
      
      renderQueueUI(queueState);
    } else {
      clearInterval(interval);
      console.log("🚀 It's the user's turn! Polling stopped.");
    }
  }, 5000);
};
