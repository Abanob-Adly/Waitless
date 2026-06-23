import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { generateToken, sha256 } from '../utils/otp.js';
import RefreshToken from '../models/refreshToken.js';

const ACCESS_TTL_SEC  = 15 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

export const tokenService = {
  signAccessToken(account, activeOrgId = null) {
    return jwt.sign(
      {
        sub: account._id.toString(),
        role: account.role,
        activeOrg: activeOrgId ? activeOrgId.toString() : null,
      },
      env.jwt.accessSecret,
      { expiresIn: ACCESS_TTL_SEC }
    );
  },

  verifyAccessToken(token) {
    return jwt.verify(token, env.jwt.accessSecret);
  },

  async issueRefreshToken(accountId, { ip, userAgent } = {}) {
    const raw = generateToken(48);
    await RefreshToken.create({
      account:   accountId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      ip, userAgent,
    });
    return raw;
  },

  async rotateRefreshToken(rawToken, { ip, userAgent } = {}) {
    const oldDoc = await RefreshToken.findOne({ tokenHash: sha256(rawToken) });

    if (!oldDoc || oldDoc.revokedAt || oldDoc.expiresAt < new Date()) {
      // Re-use of revoked token = breach attempt → revoke entire chain
      if (oldDoc?.revokedAt) {
        await RefreshToken.updateMany(
          { account: oldDoc.account, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
      }
      return null;
    }

    const newRaw = generateToken(48);
    const newDoc = await RefreshToken.create({
      account:   oldDoc.account,
      tokenHash: sha256(newRaw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      ip, userAgent,
    });

    oldDoc.revokedAt  = new Date();
    oldDoc.replacedBy = newDoc._id;
    await oldDoc.save();

    return { newRaw, accountId: oldDoc.account };
  },

  async revokeRefreshToken(rawToken) {
    await RefreshToken.updateOne(
      { tokenHash: sha256(rawToken) },
      { $set: { revokedAt: new Date() } }
    );
  },

  async revokeAllForAccount(accountId) {
    await RefreshToken.updateMany(
      { account: accountId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  },
};