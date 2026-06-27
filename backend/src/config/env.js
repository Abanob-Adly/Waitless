import 'dotenv/config';

const required = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing required env: ${k}`);
  return v;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  
  port: process.env.PORT || 3000,

  db: {
    uri: required('MONGO_URI'), 
  },

  jwt: {
    accessSecret:  required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl:  '15m',
    refreshTtl: '30d',
  },

  bcrypt: { rounds: 12 },

  email: {
    resend: required('RESEND_API_KEY'),
  },

  otp: {
    length: 6,
    ttlMinutes: 10,
    maxAttempts: 5,
  },

  passwordReset: {
    ttlMinutes: 30,
  },

  invite: {
    ttlDays: 7,
  },

  whatsapp: {
    accessToken:   process.env.WHATSAPP_ACCESS_TOKEN   || null,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  queue: {
    gracePeriodMin: Number(process.env.QUEUE_GRACE_PERIOD_MIN) || 5,
  },
};
