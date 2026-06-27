import express from "express";
import { env } from "./config/env.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import membershipRoutes from "./routes/membership.js";
import orgRoutes from "./routes/orgRoutes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/authenticate.js";
import { validate } from "./middleware/validate.js";
import { patientController, patientSchemas } from "./controllers/patientController.js";
import { appointmentController } from "./controllers/appointmentController.js";
import { startSessionGeneratorCron } from "./jobs/sessionGenerator.js";
import cors from "cors";

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (_req, res) => res.send("OK"));

// Auth
app.use("/auth", authRoutes);

// Invites (accept flow)
app.use("/memberships", membershipRoutes);

// Organization and all nested resources (branches, members, schedules, sessions, queue, patients, appointments)
app.use("/orgs", orgRoutes);

// Marketplace (public API)
app.use("/marketplace", marketplaceRoutes);

// Reviews (public — token-based)
app.use("/reviews", reviewRoutes);

// Patient self-service endpoints
app.get("/patients/me", authenticate, patientController.getOwn);
app.patch("/patients/me", authenticate, validate(patientSchemas.updateOwn), patientController.updateOwn);

// Patient: own appointment history
app.get("/appointments/mine", authenticate, appointmentController.getOwn);

// Public appointment tracking (no auth — token-based)
app.get("/appointments/track/:token", appointmentController.track);

app.use(errorHandler);

startSessionGeneratorCron();

app.listen(env.port, () => {
  console.log(`Server Started on port: ${env.port}`);
});
