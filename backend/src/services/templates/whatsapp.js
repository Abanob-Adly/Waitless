/**
 * Maps internal notification event names → WhatsApp template names.
 *
 * MVP: uses Meta's sample templates as placeholders so we can send real
 * WhatsApp messages today. Once branded templates are approved, replace
 * the right-hand side values only — no other code changes needed.
 *
 * Variable order must match template placeholders {{1}}, {{2}}, ...
 * (Insertion order of the `variables` object in notificationService is
 *  what the WhatsApp provider serializes.)
 */
export const NOTIFICATION_TEMPLATES = {
  phone_verify_otp: {
    name: 'sample_auth_code',
    category: 'authentication',
    language: 'en_US',
    variables: ['code'],
  },
  
  // Queue lifecycle 
  queue_booked: {
    // Real: "You're #{{1}} in Dr. {{2}}'s queue. Estimated wait: {{3}} min."
    // Sample stand-in accepts 3 vars.
    name: 'sample_flight_confirmation',
    language: 'en_US',
    variables: ['positionInQueue', 'doctorName', 'estimatedWaitMin'],
  },

  queue_you_are_next: {
    // Real: "You're next! Please head to Dr. {{1}}'s clinic now."
    name:      'sample_issue_resolution',   // 1 var (name)
    variables: ['doctorName'],
  },
  queue_your_turn: {
    // Real: "It's your turn now. You have {{1}} minutes to arrive."
    name:      'sample_shipping_confirmation',  // 1 var (days → we send minutes)
    variables: ['gracePeriodMin'],
  },
  queue_missed: {
    // Real: "You missed your turn with Dr. {{1}}. Please book again."
    name:      'sample_issue_resolution',
    variables: ['doctorName'],
  },
  queue_cancelled: {
    // Real: "Your appointment with Dr. {{1}} on {{2}} was cancelled."
    name:      'sample_flight_confirmation',
    variables: ['doctorName', 'sessionDate', 'appointmentCode'],
  },

  //  Session lifecycle 
  session_starting_soon: {
    // Real: "Dr. {{1}}'s session starts in {{2}} minutes."
    name:      'sample_shipping_confirmation',
    variables: ['minutesUntilStart'],
  },

  //  Fallback / smoke test
  hello: {
    name:      'hello_world',
    variables: [],
  },
};

/**
 * Resolve an internal event name to a ready template payload.
 * Throws if the event isn't mapped so we notice missing configs immediately.
 */
export function resolveTemplate(event, data = {}) {
  const tpl = NOTIFICATION_TEMPLATES[event];
  if (!tpl) throw new Error(`No WhatsApp template configured for event '${event}'`);

  return {
    templateName: tpl.name,
    language:     tpl.language ?? 'en_US',
    category:     tpl.category ?? 'utility',
    // Ordered array, no reliance on object key order
    params:       tpl.variables.map(k => data[k] ?? ''),
  };
}