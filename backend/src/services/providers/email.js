import { Resend } from 'resend';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

const resend = env.email?.resend ? new Resend(env.email.resend) : null;

export const emailProvider = {
  async send({ to, subject, body, html }) {
    // Dev stub — no API key configured
    if (!resend) {
      console.log(`[Email stub] To: ${to} | Subject: ${subject}\n${body}`);
      return { id: null, stub: true };
    }

    const { data, error } = await resend.emails.send({
      from:    'Waitless <onboarding@resend.dev>',
      to:      [to],
      subject,
      text:    body,
      html:    html || undefined,
    });

    if (error) {
      throw new AppError(`Email provider error: ${error.message}`, 400, 'EMAIL_PROVIDER_ERROR');
    }
    return data;
  },
};