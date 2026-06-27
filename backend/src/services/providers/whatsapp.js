import { env } from '../../config/env.js';

export const whatsappProvider = {
  async send({ to, templateName, variables }) {
    if (!env.whatsapp?.accessToken || !env.whatsapp?.phoneNumberId) {
      console.log(`[WhatsApp stub] Would send '${templateName}' to ${to}:`, variables);
      return { messageId: null };
    }

    const url = `https://graph.facebook.com/v19.0/${env.whatsapp.phoneNumberId}/messages`;

    const components = Object.entries(variables).map(([, value]) => ({
      type:       'text',
      text:       String(value),
    }));

    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name:     templateName,
        language: { code: 'ar' },
        components: components.length
          ? [{ type: 'body', parameters: components }]
          : [],
      },
    };

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${env.whatsapp.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'WhatsApp API error');

    return { messageId: data.messages?.[0]?.id || null };
  },
};
