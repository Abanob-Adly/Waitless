// services/providers/paymob.js
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

/**
 * Paymob provider (MVP) — Intention API flow.
 *
 *   1. createIntention()  → returns a checkout URL to redirect the user to
 *   2. verifyHmac()       → validates the webhook Paymob sends after payment
 */

export const paymobProvider = {
  async createIntention({ amountCents, currency, merchantOrderId, billingData, items }) {
    // Dev stub — no creds, no calls.
    if (!env.paymob?.secretKey) {
      console.log('[Paymob stub] Would create intention:', { amountCents, currency, merchantOrderId });
      return { checkoutUrl: `https://example.test/checkout?ref=${merchantOrderId}`, stub: true };
    }

    const res = await fetch(`${env.paymob.baseUrl}/v1/intention/`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Token ${env.paymob.secretKey}`,
      },
      body: JSON.stringify({
        amount:            amountCents,
        currency,
        payment_methods:   [env.paymob.integrationId], // one method is enough for MVP
        items,
        billing_data:      billingData,
        special_reference: merchantOrderId,
        notification_url:  env.paymob.notificationUrl,
        redirection_url:   env.paymob.redirectionUrl,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();
    if (!res.ok) throw new AppError(data?.detail || 'Paymob error', res.status, 'PAYMOB_ERROR');

    const checkoutUrl =
      `${env.paymob.baseUrl}/unifiedcheckout/` +
      `?publicKey=${env.paymob.publicKey}&clientSecret=${data.client_secret}`;

    return { checkoutUrl, intentionId: data.id };
  },

  /**
   * Verify the HMAC Paymob sends with every webhook.
   * The 20 fields below MUST be concatenated in this exact order.
   */
  verifyHmac(obj, providedHmac) {
    if (!env.paymob?.hmacSecret || !providedHmac) return false;

    const fields = [
      'amount_cents', 'created_at', 'currency', 'error_occured',
      'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
      'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
      'is_voided', 'order.id', 'owner', 'pending',
      'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
    ];

    const signedString = fields
      .map(path => path.split('.').reduce((o, k) => o?.[k], obj) ?? '')
      .join('');

    const expected = crypto
      .createHmac('sha512', env.paymob.hmacSecret)
      .update(signedString)
      .digest('hex');

    return expected === String(providedHmac);
  },
};