import VerificationToken from "../models/verificationToken.js";
import { generateOtp, generateToken, hashCode, verifyCode } from "../utils/otp.js";
import { emailProvider } from "./providers/email.js";
import { whatsappProvider } from "./providers/whatsapp.js";
import { env } from "../config/env.js";
import { AppError, NotFound, TooMany } from "../utils/errors.js";
import { resolveTemplate } from "./templates/whatsapp.js";

const PURPOSE_CONFIG = {
  email_verify: { channel: "email", kind: "otp", ttlMin: env.otp.ttlMinutes },
  phone_verify: {
    channel: "whatsapp",
    kind: "otp",
    ttlMin: env.otp.ttlMinutes,
  },
  password_reset: {
    channel: "email",
    kind: "token",
    ttlMin: env.passwordReset.ttlMinutes,
  },
};

export const verificationService = {
  async issue({ account, purpose, sendTo }) {
    const cfg = PURPOSE_CONFIG[purpose];
    if (!cfg) throw new AppError("Unknown verification purpose");

    // Invalidate prior unconsumed tokens for this purpose
    await VerificationToken.deleteMany({
      account: account._id,
      purpose,
      consumedAt: null,
    });

    const rawCode =
      cfg.kind === "otp" ? generateOtp(env.otp.length) : generateToken(32);
    const codeHash = await hashCode(rawCode);

    await VerificationToken.create({
      account: account._id,
      purpose,
      codeHash,
      sentTo: sendTo,
      channel: cfg.channel,
      expiresAt: new Date(Date.now() + cfg.ttlMin * 60_000),
    });

    // Dispatch
    if (cfg.channel === "email") {
      await emailProvider.send({
        to: sendTo,
        subject: this._subjectFor(purpose),
        body: this._bodyFor(purpose, rawCode),
      });
    } else if (cfg.channel === "whatsapp") {
      
      const resolved = resolveTemplate('phone_verify_otp', { code: rawCode });
      
      try {
        await whatsappProvider.send({ to: sendTo, ...resolved });
      } catch (err) {
        if (env.nodeEnv !== 'production') {
          console.log(`[verification] OTP for ${sendTo}: ${rawCode} (WA send failed: ${err.message})`);
        } else {
          throw err;
        }
      }

    } else {
      throw new AppError(`Unsupported channel '${cfg.channel}'`);
    }
  },

  async consume({ account, purpose, code }) {
    const doc = await VerificationToken.findOne({
      account: account._id,
      purpose,
      consumedAt: null,
    }).sort({ createdAt: -1 });

    if (!doc) throw NotFound("No active verification request");
    if (doc.expiresAt < new Date())
      throw new AppError("Code expired", 410, "EXPIRED");
    if (doc.attempts >= env.otp.maxAttempts) throw TooMany("Too many attempts");

    const ok = await verifyCode(code, doc.codeHash);
    if (!ok) {
      doc.attempts += 1;
      await doc.save();
      throw new AppError("Invalid code", 401, "INVALID_CODE");
    }

    doc.consumedAt = new Date();
    await doc.save();
    return true;
  },

  _subjectFor(purpose) {
    return {
      email_verify: "Verify your Waitless account",
      password_reset: "Reset your Waitless password",
    }[purpose];
  },

  _bodyFor(purpose, code) {
    if (purpose === "password_reset") {
      return `Your password reset link is: ${env.app.url}/reset-password?token=${encodeURIComponent(code)}`;
    }
    return `Your Waitless code is: ${code}`;
  },
};
