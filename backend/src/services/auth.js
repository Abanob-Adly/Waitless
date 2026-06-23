import Account from '../models/account.js';
import PatientProfile from '../models/patientProfile.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError, Conflict, NotFound, Unauthorized } from '../utils/errors.js';
import { tokenService } from './token.js';
import { verificationService } from './verification.js';

export const authService = {
  // Patient Registration
  async registerPatient({ email, phone, password, fullName }) {
    if (await Account.findOne({ email })) throw Conflict('Email already in use');

    const account = await Account.create({
      email, phone, fullName,
      passwordHash: await hashPassword(password),
      role: 'patient',
      status: 'pending_verification',
    });

    await PatientProfile.create({
      accountId: account._id,
      fullName, phone,
    });

    // Fire-and-forget verification
    await verificationService.issue({
      account, purpose: 'email_verify', sendTo: email,
    });

    return account;
  },

  // Worker Registration
  // Note: invited workers use a different path — see invite.js
  async registerWorker({ email, phone, password, fullName }) {
    if (await Account.findOne({ email })) throw Conflict('Email already in use');

    const account = await Account.create({
      email, phone, fullName,
      passwordHash: await hashPassword(password),
      role: 'staff',
      status: 'pending_verification',
    });

    await verificationService.issue({
      account, purpose: 'email_verify', sendTo: email,
    });

    return account;
  },

  // Login
  async loginPatient({ email, password, ip, userAgent }) {
    const account = await Account.findOne({
      email: email,
      role: 'Patient'
    }).select('+passwordHash');
    if (!account) throw Unauthorized('Invalid credentials');
    if (account.status === 'deleted') throw Unauthorized('Account deleted');
    if (account.status === 'deactivated') throw Unauthorized('Account deactivated');
    if (account.status === 'pending_verification') throw Unauthorized('Account is not verified');

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) throw Unauthorized('Invalid credentials');

    account.lastLoginAt = new Date();
    await account.save();

    const accessToken = tokenService.signAccessToken(account);
    const refreshToken = await tokenService.issueRefreshToken(account._id, { ip, userAgent });

    return { account, accessToken, refreshToken };
  },
  async loginWorker({ email, password, ip, userAgent }) {
    const account = await Account.findOne({
      email: email,
      role: 'Worker'
    }).select('+passwordHash');
    if (!account) throw Unauthorized('Invalid credentials');
    if (account.status === 'deleted') throw Unauthorized('Account deleted');
    if (account.status === 'deactivated') throw Unauthorized('Account deactivated');
    if (account.status === 'pending_verification') throw Unauthorized('Account is not verified');

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) throw Unauthorized('Invalid credentials');

    account.lastLoginAt = new Date();
    await account.save();

    const accessToken = tokenService.signAccessToken(account);
    const refreshToken = await tokenService.issueRefreshToken(account._id, { ip, userAgent });

    return { account, accessToken, refreshToken };
  },

  // Refresh
  async refresh({ refreshToken, ip, userAgent }) {
    const result = await tokenService.rotateRefreshToken(refreshToken, { ip, userAgent });
    if (!result) throw Unauthorized('Invalid refresh token');

    const account = await Account.findById(result.accountId);
    if (!account || account.status !== 'active') throw Unauthorized();

    return {
      accessToken: tokenService.signAccessToken(account),
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

  async confirmPasswordReset({ email, token, newPassword }) {
    const account = await Account.findOne({ email });
    if (!account) throw new AppError('Invalid reset token', 401);

    await verificationService.consume({ account, purpose: 'password_reset', code: token });

    account.passwordHash = await hashPassword(newPassword);
    await account.save();

    // Revoke all sessions on password change
    await tokenService.revokeAllForAccount(account._id);

    return { ok: true };
  },
};