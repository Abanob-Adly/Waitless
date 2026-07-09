import Notification from '../models/Notification.js';
import { whatsappProvider } from './providers/whatsapp.js';
import { resolveTemplate } from "./templates/whatsapp.js";

const THROTTLE_MINUTES = 5;

export const notificationService = {
async queueNotification({ event, appointment, session, patientProfile, toPhone, data = {} }) {
  
  // Throttle: skip if same template was sent to this appointment recently
    if (appointment?._id) {
      const cutoff = new Date(Date.now() - THROTTLE_MINUTES * 60 * 1000);
      const recent = await Notification.findOne({
        appointment: appointment._id,
        event,
        createdAt: { $gt: cutoff },
        status: { $in: ['queued', 'sent', 'delivered'] },
      });
      if (recent) return null;
    }
    
    const phone = toPhone || patientProfile?.phone || appointment?.patientProfile?.phone;
    if (!phone) return null;
    
    const resolved = resolveTemplate(event, data);

    const notification = await Notification.create({
      channel:        'whatsapp',
      toPhone:        phone,
      template: resolved.templateName,
      variables,
      appointment:    appointment?._id || null,
      session:        session?._id     || null,
      patientProfile: patientProfile?._id || appointment?.patientProfile || null,
      status:         'queued',
    });

    try {
      const { messageId } = await whatsappProvider.send({
        to:           phone,
        templateName: resolved.templateName,
        variables,
      });

      notification.status            = 'sent';
      notification.sentAt            = new Date();
      notification.providerMessageId = messageId || undefined;
    } catch (err) {
      notification.status   = 'failed';
      notification.failedAt = new Date();
      notification.error    = err.message;
    }

    notification.attempts += 1;
    await notification.save();

    return notification;
  },
};
