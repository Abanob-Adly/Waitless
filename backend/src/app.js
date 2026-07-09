import express from "express";
import { env } from "./config/env.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import membershipRoutes from "./routes/membership.js";
import orgRoutes from "./routes/orgRoutes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import appointmentPaymentRoutes from "./routes/appointmentPaymentRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import adminPayoutRoutes from "./routes/adminPayoutRoutes.js";
import { paymentController } from "./controllers/paymentController.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/authenticate.js";
import { validate } from "./middleware/validate.js";
import {
  patientController,
  patientSchemas,
} from "./controllers/patientController.js";
import {
  appointmentController,
  appointmentSchemas,
} from "./controllers/appointmentController.js";
import { sessionNoteController } from "./controllers/sessionNoteController.js";
import { startSessionGeneratorCron } from "./jobs/sessionGenerator.js";
import { startSessionAutoCloseCron } from "./jobs/sessionAutoClose.js";
import { startSessionAutoStartCron } from "./jobs/sessionAutoStart.js";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

connectDB();

const app = express();
// Behind ngrok/a reverse proxy, req.ip is the proxy's own address unless we
// trust its X-Forwarded-For — without this every tunneled client collapses
// onto one IP and shares a single rate-limit bucket.
app.set("trust proxy", 1);
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;

// Failing open to "allow any origin" (the old behavior) is fine for local
// dev, but silently doing that in production if the env var is ever missing
// would combine with credentials:true into a real CORS hole. Fail loudly
// instead so a misconfigured deploy can't ship silently.
if (!allowedOrigins && env.nodeEnv === "production") {
  throw new Error("ALLOWED_ORIGINS must be set in production");
}

app.use(
  cors({
    origin: allowedOrigins ?? true,
    credentials: true,
  }),
);
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests, please try again later.",
  },
});

// Health check
app.get("/", (_req, res) => res.send("UP"));

// Auth
app.use("/auth", authLimiter, authRoutes);

// Invites (accept flow)
app.use("/memberships", membershipRoutes);

// Organization and all nested resources (branches, members, schedules, sessions, queue, patients, appointments)
app.use("/orgs", orgRoutes);

// Marketplace (public API)
app.use("/marketplace", marketplaceRoutes);

// Reviews (public — token-based)
app.use("/reviews", reviewRoutes);

// /:appointmentId/pay + /payments/:paymentId/result
app.use("/appointments", appointmentPaymentRoutes);

// Generic payment result lookup (works for both subscription & appointment payments)
app.get("/payments/result", authenticate, paymentController.result);

// payment and billing (organization-level)
app.use("/webhooks", webhookRoutes);

// Platform admin: payout management
app.use("/admin", adminPayoutRoutes);

// Patient self-service endpoints
app.get("/patients/me", authenticate, patientController.getOwn);
app.patch(
  "/patients/me",
  authenticate,
  validate(patientSchemas.updateOwn),
  patientController.updateOwn,
);
app.get(
  "/patients/me/notes",
  authenticate,
  sessionNoteController.getMySharedNotes,
);

// Patient: own appointment history
app.get("/appointments/mine", authenticate, appointmentController.getOwn);

// Patient: self-cancel
app.delete(
  "/appointments/:appointmentId/cancel",
  authenticate,
  appointmentController.selfCancel,
);

// Patient: edit their own note to the doctor
app.patch(
  "/appointments/:appointmentId/notes",
  authenticate,
  validate(appointmentSchemas.updateOwnNotes),
  appointmentController.updateOwnNotes,
);

// Public appointment tracking & self-cancel (no auth — token-based)
app.get("/appointments/track/:token", appointmentController.track);
app.get("/appointments/track/:token/sse", appointmentController.trackSSE);
app.delete("/appointments/track/:token", appointmentController.cancelByToken);

app.use(errorHandler);

startSessionGeneratorCron();
startSessionAutoCloseCron();
startSessionAutoStartCron();

app.listen(env.port, () => {
  console.log(`Server Started on port: ${env.port}`);
});
export default app;
