import crypto from 'crypto';
import { env } from '../config/env.js';

const PAYMOB_BASE = 'https://accept.paymob.com';

async function paymobPost(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${PAYMOB_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paymob API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const paymobService = {
  /**
   * Full hosted-iframe initiation flow:
   * 1. Authenticate → token
   * 2. Register order → orderId
   * 3. Request payment key → paymentKey
   * Returns the iframe URL.
   */
  async initiatePayment({ amountCents, currency = 'EGP', appointmentId, billingData }) {
    // Step 1: auth
    const authRes = await paymobPost('/api/auth/tokens', { api_key: env.paymob.apiKey });
    const token = authRes.token;
    if (!token) throw new Error('Paymob auth failed — no token returned');

    // Step 2: order registration
    const orderRes = await paymobPost('/api/ecommerce/orders', {
      auth_token:      token,
      delivery_needed: false,
      amount_cents:    String(amountCents),
      currency,
      merchant_order_id: String(appointmentId),
      items:           [],
    }, token);
    const orderId = orderRes.id;
    if (!orderId) throw new Error('Paymob order registration failed');

    // Step 3: payment key
    const keyRes = await paymobPost('/api/acceptance/payment_keys', {
      auth_token:      token,
      amount_cents:    String(amountCents),
      expiration:      3600,
      order_id:        orderId,
      currency,
      integration_id:  Number(env.paymob.integrationId),
      billing_data:    billingData,
      lock_order_when_paid: 'false',
    }, token);

    const paymentKey = keyRes.token;
    if (!paymentKey) throw new Error('Paymob payment key request failed');

    const iframeUrl = `${PAYMOB_BASE}/api/acceptance/iframes/${env.paymob.iframeId}?payment_token=${paymentKey}`;

    return { iframeUrl, orderId: String(orderId) };
  },

  /**
   * Verify the HMAC sent in Paymob's webhook callback.
   * Returns true if the signature is valid.
   */
  verifyHmac(queryParams) {
    // Fields Paymob concatenates in exactly this order
    const HMAC_FIELDS = [
      'amount_cents', 'created_at', 'currency', 'error_occured',
      'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
      'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
      'is_voided', 'order', 'owner', 'pending',
      'source_data_pan', 'source_data_sub_type', 'source_data_type', 'success',
    ];

    const concatenated = HMAC_FIELDS.map((f) => queryParams[f] ?? '').join('');
    const computed = crypto
      .createHmac('sha512', env.paymob.hmacSecret)
      .update(concatenated)
      .digest('hex');

    return computed === queryParams.hmac;
  },
};
