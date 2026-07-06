import express from 'express';
import { reviewController, reviewSchemas } from '../controllers/reviewController.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// GET /reviews/submit?token=... — check if appointment is reviewable
router.get('/submit', reviewController.getReviewContext);

// POST /reviews/submit — submit a rating + optional comment
router.post('/submit', validate(reviewSchemas.submit), reviewController.submitReview);

export default router;
