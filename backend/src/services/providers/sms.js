export const smsProvider = {
  async send({ to, body }) {
    // TODO: integrate Twilio / WhatsApp Business
    console.log(`📱 SMS → ${to}\n   ${body}`);
  },
};