import { z } from 'zod';
import Appointment from '../models/Appointment.js';
import Review from '../models/Review.js';
import { Membership, DoctorMembership } from '../models/Membership.js';
import { AppError, NotFound } from '../utils/errors.js';

export const reviewSchemas = {
  submit: z.object({
    token:   z.string().min(1),
    rating:  z.number().int().min(1).max(5),
    comment: z.string().max(300).optional(),
  }),
};

export const reviewController = {
  async getReviewContext(req, res) {
    const { token } = req.query;
    if (!token) throw new AppError('token query param required', 400);

    const appointment = await Appointment.findOne({ accessToken: token });
    if (!appointment) throw NotFound('Appointment not found');

    if (appointment.status !== 'completed') {
      return res.json({ data: { reviewable: false, reason: 'not_completed' } });
    }

    const existing = await Review.exists({ appointment: appointment._id });
    if (existing) {
      return res.json({ data: { reviewable: false, reason: 'already_reviewed' } });
    }

    const doctorDoc = await Membership.findById(appointment.doctorMembership)
      .populate('account', 'fullName')
      .lean();

    return res.json({
      data: {
        reviewable: true,
        doctorName: doctorDoc?.account?.fullName ?? '',
      },
    });
  },

  async submitReview(req, res) {
    const { token, rating, comment } = req.body;

    const appointment = await Appointment.findOne({ accessToken: token });
    if (!appointment) throw NotFound('Appointment not found');
    if (appointment.status !== 'completed') throw new AppError('Appointment is not completed', 422);

    const existing = await Review.exists({ appointment: appointment._id });
    if (existing) throw new AppError('Review already submitted', 409);

    await Review.create({
      appointment:      appointment._id,
      doctorMembership: appointment.doctorMembership,
      reviewToken:      token,
      rating,
      comment: comment || undefined,
    });

    // Update doctor ratingStats atomically
    const doctor = await DoctorMembership.findById(appointment.doctorMembership);
    if (doctor) {
      const oldCount = doctor.ratingStats?.count ?? 0;
      const oldAvg   = doctor.ratingStats?.avg   ?? 0;
      const newCount = oldCount + 1;
      const newAvg   = (oldAvg * oldCount + rating) / newCount;
      doctor.ratingStats = { count: newCount, avg: Math.round(newAvg * 100) / 100 };
      await doctor.save();
    }

    res.json({ data: { success: true } });
  },
};
