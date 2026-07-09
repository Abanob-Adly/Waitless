import { z } from 'zod';
import { authService } from '../services/auth.js';
import Account from '../models/Account.js';

// schema validation
const Email = z.string().email().toLowerCase();
const Password = z.string().min(8).max(128);
// Accept raw Egyptian format (01XXXXXXXXX) or E.164 (+201XXXXXXXXX)
const Phone = z.string().regex(/^(\+201[0125]\d{8}|01[0125]\d{8})$/, 'Invalid Egyptian phone number — must be 01XXXXXXXXX or +201XXXXXXXXX');
export const schemas = {
    register: z.object({
        email: Email, password: Password,
        fullName: z.string().min(2).max(100),
        phone: Phone.optional(),
        dateOfBirth: z.string().optional(),
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

    async checkAvailability(req, res) {
        const { email, phone } = req.query;
        const result = { emailTaken: false, phoneTaken: false };
        if (email) {
            result.emailTaken = !!(await Account.exists({ email: String(email).toLowerCase().trim() }));
        }
        if (phone) {
            const normalized = String(phone).trim();
            const e164 = normalized.startsWith('+') ? normalized
                : normalized.startsWith('201') ? `+${normalized}`
                : normalized.startsWith('01') ? `+2${normalized}`
                : normalized;
            result.phoneTaken = !!(await Account.exists({ phone: e164 }));
        }
        res.json(result);
    },
};

// a helper function to return public data account public data only
const pickPublic = (acc) => ({
    id: acc._id,
    email: acc.email, phone: acc.phone, fullName: acc.fullName,
    role: acc.role, status: acc.status,
    isEmailVerified: acc.isEmailVerified, isPhoneVerified: acc.isPhoneVerified,
});