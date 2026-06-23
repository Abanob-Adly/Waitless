import crypto from 'crypto';
import bcrypt from 'bcrypt';

// 6-digit numeric OTP (good for SMS/email)
export const generateOtp = (length = 6) => 
  Array.from({ length }, () => crypto.randomInt(0, 10)).join('');

// Long URL-safe token for password reset / invites
export const generateToken = (bytes = 32) =>
  crypto.randomBytes(bytes).toString('base64url');

export const hashCode = (code) => bcrypt.hash(code, 10);
export const verifyCode = (code, hash) => bcrypt.compare(code, hash);

// For refresh tokens — fast hash (we lookup by hash, can't bcrypt-compare)
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');