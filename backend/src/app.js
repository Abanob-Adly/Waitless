import express from "express";
import { env } from "./config/env.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import membershipRoutes from "./routes/membership.js";
import orgRoutes from "./routes/orgRoutes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/authenticate.js";
import { validate } from "./middleware/validate.js";
import { patientController, patientSchemas } from "./controllers/patientController.js";
import { appointmentController } from "./controllers/appointmentController.js";
import { startSessionGeneratorCron } from "./jobs/sessionGenerator.js";
import { startLateStartPenaltyCron } from "./jobs/lateStartPenalty.js";
import { startSessionAutoCloseCron } from "./jobs/sessionAutoClose.js";
import cors from "cors";
import rateLimit from "express-rate-limit";

connectDB();

const app = express();
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : true,
  credentials: true,
}));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
});

// Health check
app.get("/", (_req, res) => res.send("OK"));

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

// Wallet (personal — patient / doctor)
app.use("/wallet", walletRoutes);

// Patient self-service endpoints
app.get("/patients/me", authenticate, patientController.getOwn);
app.patch("/patients/me", authenticate, validate(patientSchemas.updateOwn), patientController.updateOwn);

// Patient: own appointment history
app.get("/appointments/mine", authenticate, appointmentController.getOwn);

// Patient: self-cancel — applies cancellation penalty if within 1 hour of session start
app.delete("/appointments/:appointmentId/cancel", authenticate, appointmentController.selfCancel);

// Public appointment tracking (no auth — token-based)
app.get("/appointments/track/:token", appointmentController.track);

app.use(errorHandler);

startSessionGeneratorCron();
startLateStartPenaltyCron();
startSessionAutoCloseCron();

app.listen(env.port, () => {
  console.log(`Server Started on port: ${env.port}`);
});
