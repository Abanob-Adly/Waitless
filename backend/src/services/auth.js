import Account from '../models/Account.js';
import PatientProfile from '../models/PatientProfile.js';
import { Membership } from '../models/Membership.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError, Conflict, NotFound, Unauthorized } from '../utils/errors.js';
import { tokenService } from './token.js';
import { verificationService } from './verification.js';
import { verifyCode } from "../utils/otp.js";
import VerificationToken from '../models/verificationToken.js';

// Strips formatting and converts to E.164 (Egyptian default: 01X → +201X).
function normalizePhone(input = '') {
  const digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('201') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('01') && digits.length === 11) return `+2${digits}`;
  return digits; // return as-is if pattern is unrecognised
}

// Normalises phone/email identifier for login lookups.
// 01XXXXXXXXX → +201XXXXXXXXX; otherwise treated as email.
function normalizeIdentifier(input = '') {
  const str = input.trim();
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 10) {
    if (digits.startsWith('20')) return { field: 'phone', value: `+${digits}` };
    if (digits.startsWith('0'))  return { field: 'phone', value: `+2${digits}` };
    if (digits.length >= 10)     return { field: 'phone', value: `+${digits}` };
  }
  return { field: 'email', value: str.toLowerCase() };
}

export const authService = {
  // Patient Registration
  async registerPatient({ email, phone, password, fullName, dateOfBirth }) {
    if (await Account.findOne({ email })) throw Conflict('Email already in use');

    // Normalise phone to E.164 (+201XXXXXXXXX) to prevent false-unique duplicates
    const normalizedPhone = phone ? normalizePhone(phone) : undefined;
    if (normalizedPhone && await Account.findOne({ phone: normalizedPhone })) {
      throw Conflict('This phone number is already registered to another account. Please use a different number.');
    }

    const account = await Account.create({
      email, phone: normalizedPhone ?? phone, fullName,
      passwordHash: await hashPassword(password),
      role: 'patient',
      // Auto-activate so the frontend works without email verification in development.
      // A real production deploy can re-enable verification by changing this to
      // 'pending_verification' and un-commenting the verificationService.issue call.
      status: 'active',
      isEmailVerified: true,
    });

    await PatientProfile.create({
      accountId: account._id,
      fullName, phone: normalizedPhone ?? phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    });

    return account;
  },

  // Worker Registration
  // Note: invited workers use a different path — see invite.js
  async registerWorker({ email, phone, password, fullName }) {
    if (await Account.findOne({ email })) throw Conflict('Email already in use');

    const normalizedPhone = phone ? normalizePhone(phone) : undefined;
    if (normalizedPhone && await Account.findOne({ phone: normalizedPhone })) {
      throw Conflict('This phone number is already registered to another account. Please use a different number.');
    }

    const account = await Account.create({
      email, phone: normalizedPhone ?? phone, fullName,
      passwordHash: await hashPassword(password),
      role: 'staff',
      status: 'active',
      isEmailVerified: true,
    });

    return account;
  },

  // Login — accepts phone number OR email as identifier
  async loginPatient({ identifier, password, ip, userAgent }) {
    const { field, value } = normalizeIdentifier(identifier);
    const account = await Account.findOne({
      [field]: value,
      role: 'patient',
    }).select('+passwordHash');
    if (!account) throw Unauthorized('Invalid credentials');
    if (account.status === 'deleted') throw Unauthorized('Account deleted');
    if (account.status === 'deactivated') throw Unauthorized('Account deactivated');
    if (account.status === 'pending_verification') throw Unauthorized('Please verify your email first');

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) throw Unauthorized('Invalid credentials');

    account.lastLoginAt = new Date();
    await account.save();

    const accessToken = tokenService.signAccessToken(account);
    const refreshToken = await tokenService.issueRefreshToken(account._id, { ip, userAgent });

    return { account, accessToken, refreshToken };
  },

  async loginWorker({ identifier, password, ip, userAgent }) {
    const { field, value } = normalizeIdentifier(identifier);
    const account = await Account.findOne({
      [field]: value,
      role: 'staff',
    }).select('+passwordHash');
    if (!account) throw Unauthorized('Invalid credentials');
    if (account.status === 'deleted') throw Unauthorized('Account deleted');
    if (account.status === 'deactivated') throw Unauthorized('Account deactivated');
    if (account.status === 'pending_verification') throw Unauthorized('Please verify your email first');

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) throw Unauthorized('Invalid credentials');

    account.lastLoginAt = new Date();
    await account.save();

    // Find the worker's primary active membership to scope the token to their org.
    // Sort by kind ascending (admin < doctor < receptionist) for deterministic selection
    // when the user holds multiple roles.
    const membership = await Membership.findOne({
      account: account._id,
      status: 'active',
    }).sort({ kind: 1 });

    const activeOrgId = membership?.organization || null;
    const accessToken = tokenService.signAccessToken(account, activeOrgId);
    const refreshToken = await tokenService.issueRefreshToken(account._id, { ip, userAgent });

    return { account, accessToken, refreshToken, membership };
  },

  // Refresh
  async refresh({ refreshToken, ip, userAgent }) {
    const result = await tokenService.rotateRefreshToken(refreshToken, { ip, userAgent });
    if (!result) throw Unauthorized('Invalid refresh token');

    const account = await Account.findById(result.accountId);
    if (!account || account.status !== 'active') throw Unauthorized();

    // Re-attach the worker's active org so the new token carries the same scope.
    let activeOrgId = null;
    if (account.role === 'staff') {
      const membership = await Membership.findOne({
        account: account._id,
        status:  'active',
      }).sort({ kind: 1 }).select('organization').lean();
      activeOrgId = membership?.organization || null;
    }

    return {
      accessToken:  tokenService.signAccessToken(account, activeOrgId),
      refreshToken: result.newRaw,
    };
  },

  // Email/Phone Verification
  async confirmEmailVerification({ accountId, code }) {
    const account = await Account.findById(accountId);
    if (!account) throw NotFound('Account not found');

    await verificationService.consume({ account, purpose: 'email_verify', code });

    account.isEmailVerified = true;
    if (account.status === 'pending_verification') account.status = 'active';
    await account.save();

    return account;
  },

  async requestPhoneVerification({ accountId }) {
    const account = await Account.findById(accountId);
    if (!account?.phone) throw new AppError('No phone on file');
    return verificationService.issue({
      account, purpose: 'phone_verify', sendTo: account.phone,
    });
  },

  async confirmPhoneVerification({ accountId, code }) {
    const account = await Account.findById(accountId);
    if (!account) throw NotFound();

    await verificationService.consume({ account, purpose: 'phone_verify', code });

    account.isPhoneVerified = true;
    await account.save();
    return account;
  },

  // Password Reset 
  async requestPasswordReset({ email }) {
    const account = await Account.findOne({ email });
    // Always return success — don't leak account existence
    if (!account) return { ok: true };

    await verificationService.issue({
      account, purpose: 'password_reset', sendTo: email,
    });
    return { ok: true };
  },

  async confirmPasswordReset({ token, newPassword }) {
    const verification = await VerificationToken.findOne({
      purpose: 'password_reset',
      consumedAt: null,
    }).sort({ createdAt: -1 });

    if (!verification) throw new AppError('Invalid reset token', 401);
    if (verification.expiresAt < new Date()) throw new AppError('Code expired', 410, 'EXPIRED');

    const ok = await verifyCode(token, verification.codeHash);
    if (!ok) throw new AppError('Invalid reset token', 401);

    const account = await Account.findById(verification.account);
    if (!account) throw new AppError('Invalid reset token', 401);

    verification.consumedAt = new Date();
    await verification.save();

    account.passwordHash = await hashPassword(newPassword);
    await account.save();

    await tokenService.revokeAllForAccount(account._id);
    return { ok: true };
  },
};