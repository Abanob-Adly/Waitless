import { paymobService } from '../services/paymobService.js';
import { orgService } from '../services/orgService.js';
import Appointment from '../models/Appointment.js';
import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';

export const paymobController = {
  /**
   * POST /payment/paymob/initiate
   * Authenticated patient initiates a card payment for a booked appointment.
   * Body: { appointmentId }
   */
  async initiate(req, res, next) {
    try {
      const { appointmentId } = req.body;
      if (!appointmentId) {
        return res.status(400).json({ error: 'appointmentId is required' });
      }

      const appointment = await Appointment.findById(appointmentId)
        .populate('patientProfile', 'fullName phone accountId')
        .populate('session', 'doctorBranchSchedule')
        .lean();

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      const patientProfile = appointment.patientProfile;
      if (String(patientProfile?.accountId) !== String(req.actor.account._id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (appointment.paymentStatus === 'success') {
        return res.status(409).json({ error: 'Already paid' });
      }

      const scheduleDoc = await DoctorBranchSchedule
        .findById(appointment.session?.doctorBranchSchedule)
        .select('consultationFee')
        .lean();
      const fee = scheduleDoc?.consultationFee?.amount ?? 0;
      if (!fee) {
        return res.status(422).json({ error: 'Consultation fee not set for this session' });
      }

      const amountCents = fee * 100;
      const billingData = {
        first_name:     (patientProfile?.fullName ?? 'Patient').split(' ')[0] || 'Patient',
        last_name:      (patientProfile?.fullName ?? 'Patient').split(' ').slice(1).join(' ') || 'N/A',
        email:          req.actor.account.email ?? 'patient@waitless.app',
        phone_number:   patientProfile?.phone ?? '+201000000000',
        country:        'EG',
        city:           'Cairo',
        street:         'N/A',
        building:       'N/A',
        floor:          'N/A',
        apartment:      'N/A',
        postal_code:    '00000',
      };

      await Appointment.findByIdAndUpdate(appointmentId, { $set: { paymentMethod: 'card' } });

      const { iframeUrl, orderId } = await paymobService.initiatePayment({
        amountCents,
        currency: 'EGP',
        appointmentId: String(appointmentId),
        billingData,
      });

      res.json({ data: { iframeUrl, orderId, amountCents, fee } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /payment/paymob/webhook
   * Called by Paymob after payment. HMAC-verified, no auth token required.
   * Handles both appointment payments and plan subscription purchases.
   */
  async webhook(req, res) {
    try {
      const params = req.query;

      if (!paymobService.verifyHmac(params)) {
        console.warn('[Paymob] Invalid HMAC — ignoring webhook');
        return res.status(200).send('ok');
      }

      const txn = req.body?.obj;
      if (!txn) return res.status(200).send('ok');

      const success           = txn.success === true || txn.success === 'true';
      const merchantOrderId   = txn.order?.merchant_order_id;
      const amountCents       = Number(txn.amount_cents ?? 0);
      const paymobTxnId       = String(txn.id ?? '');

      if (!merchantOrderId) return res.status(200).send('ok');

      // ── Plan purchase (merchant_order_id starts with "plan-") ────────────
      if (String(merchantOrderId).startsWith('plan-')) {
        if (success) {
          await orgService.activatePlanAfterPayment({
            merchantOrderId: String(merchantOrderId),
            paymobTransactionId: paymobTxnId,
          });
          console.log('[Paymob] Plan activated via card, merchantOrderId:', merchantOrderId);
        } else {
          console.warn('[Paymob] Plan payment failed, merchantOrderId:', merchantOrderId);
        }
        return res.status(200).send('ok');
      }

      // ── Appointment payment ───────────────────────────────────────────────
      const appointment = await Appointment.findById(merchantOrderId);
      if (!appointment) return res.status(200).send('ok');

      if (success && appointment.paymentStatus !== 'success') {
        appointment.paymentStatus = 'success';
        appointment.paymentMethod = 'card';
        appointment.paidAt        = new Date();
        appointment.paidAmount    = amountCents / 100;
        await appointment.save();
        console.log('[Paymob] Payment confirmed for appointment', merchantOrderId);
      } else if (!success && appointment.paymentStatus !== 'success') {
        appointment.paymentStatus = 'failed';
        await appointment.save();
        console.log('[Paymob] Payment failed for appointment', merchantOrderId);
      }

      res.status(200).send('ok');
    } catch (err) {
      console.error('[Paymob] webhook error:', err.message);
      res.status(200).send('ok');
    }
  },

  /**
   * GET /payment/paymob/callback
   * Paymob redirects the browser here after the iframe completes.
   * Redirects to the billing tab for plan purchases, or the ticket page for appointments.
   */
  callback(req, res) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const success     = req.query.success === 'true';
    const orderId     = String(req.query.merchant_order_id ?? req.query.order ?? '');

    // Plan purchases redirect to admin billing tab
    if (orderId.startsWith('plan-')) {
      return res.redirect(
        `${frontendUrl}/admin?tab=billing&payment=${success ? 'success' : 'failed'}`,
      );
    }

    // Appointment payments redirect to ticket page
    res.redirect(`${frontendUrl}/ticket?payment=${success ? 'success' : 'failed'}`);
  },
};
