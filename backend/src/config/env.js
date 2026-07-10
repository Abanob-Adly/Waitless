import 'dotenv/config';

const required = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing required env: ${k}`);
  return v;
};

const apiUrl = process.env.API_URL || 'http://localhost:3000';
const appUrl = process.env.APP_URL || 'http://localhost:5173';

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,

  app: {
    api: apiUrl,
    url: appUrl,
  },

  db: {
    uri: required("MONGO_URI"),
  },

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: "15m",
    refreshTtl: "30d",
  },

  bcrypt: { rounds: 12 },

  email: {
    resend: required("RESEND_API_KEY"),
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
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || null,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  queue: {
    gracePeriodMin: Number(process.env.QUEUE_GRACE_PERIOD_MIN) || 5,
  },

  paymob: {
    baseUrl: process.env.PAYMOB_BASE_URL || "https://accept.paymob.com",
    secretKey: process.env.PAYMOB_SECRET_KEY || null,
    publicKey: process.env.PAYMOB_PUBLIC_KEY || null,
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || null,
    integrationId: process.env.PAYMOB_INTEGRATION_ID
      ? Number(process.env.PAYMOB_INTEGRATION_ID)
      : null,
    notificationUrl:
      process.env.PAYMOB_NOTIFICATION_URL || `${apiUrl}/webhooks/paymob`,
    redirectionUrl: `https://waitless-frontend-virid.vercel.app/payment-result`,
  },
};