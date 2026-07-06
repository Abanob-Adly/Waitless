import { Resend } from "resend";
import { env } from "../../config/env.js";

const resend = new Resend(env.email.resend);
export const emailProvider = {
  async send({ to, subject, body }) {
    try {
      const { data, error } = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: [to],
        subject: subject,
        text: body,
      });
      if (error) {
        throw new AppError(`Email provider rejection: ${error.message}`, 400, 'EMAIL_PROVIDER_ERROR');
      }
      return data;
    } 
    catch (err) {
      console.error(`Failed to send email to ${to}:`, err.message);
      throw err;
    }
  },
};
