# 🗂️ Waitless Project Structure & Test Execution

### 🌳 Project Structure (Monorepo)
```text
Waitless/
├── backend/
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── integration/
│   │   │   │   ├── forceInsert.test.js
│   │   │   │   ├── sessionOps.test.js
│   │   │   │   ├── queueAdvance.test.js
│   │   │   │   ├── payAtClinic.test.js
│   │   │   │   └── marketplaceAvailability.test.js
│   │   │   └── unit/
│   │   │       └── queueLogic.test.js
│   │   ├── config/
│   │   │   └── redis.js
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── app.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── Phase1-Design/
│   ├── ERD Final.txt
│   ├── State Machine Document.txt
│   └── System Workflow.txt
└── package.json
```

### 🧪 Test Execution Results (Terminal Output)
```bash
> backend@1.0.0 test
> node --env-file=.env.test --test src/__tests__/...

▶ queueService.checkDailyCapacity
  ✔ returns correct maxPatients from session times (3.1ms)
  ✔ shows isFull=true and remainingSlots=0 when at capacity (2.4ms)
▶ queueController.cashSummary
  ✔ counts only cash-paid completed appointments (1.8ms)
  ✔ returns empty list when no cash payments exist (0.9ms)
▶ sessionService.startSession
  ✔ starts session on time without penalty (4.2ms)
  ✔ rejects starting an already-active session (1.1ms)
▶ sessionAutoClose cron logic
  ✔ selects an active session whose endTime is past the grace period (2.5ms)

ℹ tests 7
ℹ suites 4
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 142.6

✅ All tests passed successfully.
```
