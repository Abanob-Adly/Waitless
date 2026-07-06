import { env } from '../../config/env.js';

export const whatsappProvider = {
  async send({ to, templateName, params = [], language = 'en_US', category = 'utility' }) {
    const normalizedTo = String(to).replace(/[^\d]/g, '');    
    
    if (!env.whatsapp?.accessToken || !env.whatsapp?.phoneNumberId) {
      console.log(`[WhatsApp stub] Would send '${templateName}' to ${to}:`, variables);
      return { messageId: null };
    }

    const url = `https://graph.facebook.com/v19.0/${env.whatsapp.phoneNumberId}/messages`;

    const bodyParams = params.map(v => ({ type: 'text', text: String(v) }));
    const components = [];
    if (bodyParams.length) components.push({ type: 'body', parameters: bodyParams });
    if (category === 'authentication' && bodyParams.length) {
      components.push({
        type: 'button', sub_type: 'url', index: '0',
        parameters: [bodyParams[0]],
      });
    }

    const body = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'template',
      template: { name: templateName, language: { code: language }, components },
    };

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${env.whatsapp.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'WhatsApp API error');

    return { messageId: data.messages?.[0]?.id || null };
  },
};
