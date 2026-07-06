import { z } from 'zod';
import { authService } from '../services/auth.js';

// schema validation
const Email = z.string().email().toLowerCase();
const Password = z.string().min(8).max(128);
const Phone = z.string().regex(/^\+?[1-9]\d{7,14}$/);
export const schemas = {
    register: z.object({
        email: Email, password: Password,
        fullName: z.string().min(2).max(100),
        phone: Phone.optional(),
    }),
    // identifier accepts either email or phone number
    login: z.object({ identifier: z.string().min(1), password: Password }),
    refresh: z.object({ refreshToken: z.string() }),
    verifyEmail: z.object({ code: z.string().length(6) }),
    verifyPhone: z.object({ code: z.string().length(6) }),
    requestReset: z.object({ email: Email }),
    confirmReset: z.object({
      token: z.string().min(1),
      newPassword: Password,
    }),
};


// authentication controller
export const authController = {
    async registerPatient(req, res) {
        const account = await authService.registerPatient(req.body);
        res.status(201).json({ accountId: account._id, message: 'Verification code sent' });
    },

    async registerWorker(req, res) {
        const account = await authService.registerWorker(req.body);
        res.status(201).json({ accountId: account._id, message: 'Verification code sent' });
    },

    async loginPatient(req, res) {
        const { account, accessToken, refreshToken } =
            await authService.loginPatient({ ...req.body, ip: req.ip, userAgent: req.get('user-agent') });

        res.json({
            data: { account: pickPublic(account), accessToken, refreshToken },
        });
    },

    async loginWorker(req, res) {
        const { account, accessToken, refreshToken, membership } =
            await authService.loginWorker({ ...req.body, ip: req.ip, userAgent: req.get('user-agent') });

        res.json({
            data: {
                account: pickPublic(account),
                accessToken, refreshToken,
                membership: membership
                    ? {
                        kind: membership.kind,
                        orgId: String(membership.organization),
                        branchId: membership.branches?.[0]
                            ? String(membership.branches[0])
                            : undefined,
                      }
                    : null,
            },
        });
    },

    async refresh(req, res) {
        const tokens = await authService.refresh({
            refreshToken: req.body.refreshToken,
            ip: req.ip, userAgent: req.get('user-agent'),
        });
        res.json(tokens);
    },

    async logout(req, res) {
        if (req.body.refreshToken) {
            await import('../services/token.js').then(({ tokenService }) =>
                tokenService.revokeRefreshToken(req.body.refreshToken)
            );
        }
        res.json({ ok: true });
    },

    async me(req, res) {
        const account = req.actor.account;
        const membership = req.actor.activeMembership;
        res.json({
            data: {
                account: pickPublic(account),
                membership: membership
                    ? { kind: membership.kind, orgId: membership.organization }
                    : null,
            },
        });
    },

    async confirmEmailVerification(req, res) {
        await authService.confirmEmailVerification({
            accountId: req.actor.account._id, code: req.body.code,
        });
        res.json({ ok: true });
    },

    async requestPhoneVerification(req, res) {
        await authService.requestPhoneVerification({ accountId: req.actor.account._id });
        res.json({ ok: true });
    },

    async confirmPhoneVerification(req, res) {
        await authService.confirmPhoneVerification({
            accountId: req.actor.account._id, code: req.body.code,
        });
        res.json({ ok: true });
    },

    async requestPasswordReset(req, res) {
        await authService.requestPasswordReset({ email: req.body.email });
        res.json({ ok: true }); // always success — no enumeration
    },

    async confirmPasswordReset(req, res) {
        await authService.confirmPasswordReset(req.body);
        res.json({ ok: true });
    },
};

// a helper function to return public data account public data only
const pickPublic = (acc) => ({
    id: acc._id,
    email: acc.email, phone: acc.phone, fullName: acc.fullName,
    role: acc.role, status: acc.status,
    isEmailVerified: acc.isEmailVerified, isPhoneVerified: acc.isPhoneVerified,
});