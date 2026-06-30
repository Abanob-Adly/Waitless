import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { authorize } from "../policies/can.js";

import Branch from "../models/Branch.js";
import { branchController, branchSchemas } from "../controllers/branchController.js";

const router = Router();

// List branches of an organization.
// Public organizations return marketplace-safe data.
// Private organizations require membership.
router.get(
  "/",
  optionalAuthenticate,
  branchController.list,
);

// Get a single branch.
router.get("/:branchId", optionalAuthenticate, branchController.get);

// Create branch
router.post(
  "/",
  authenticate,
  validate(branchSchemas.create),
  authorize("branch.create"),
  branchController.create,
);

// Update branch
router.patch(
  "/:branchId",
  authenticate,
  validate(branchSchemas.update),
  authorize("branch.update", (req) => Branch.findById(req.params.branchId)),
  branchController.update,
);

// Delete (soft-disable or hard-delete depending on service)
router.delete(
  "/:branchId",
  authenticate,
  authorize("branch.delete", (req) => Branch.findById(req.params.branchId)),
  branchController.remove,
);

export default router;
