import { z } from 'zod';
import { inviteService } from '../services/invite.js';
import { tokenService } from '../services/token.js';

export const inviteSchemas = {
    acceptNew: z.object({
        token:             z.string(),
        fullName:          z.string().min(2),
        password:          z.string().min(8),
        phone:             z.string().optional(),
        yearsOfExperience: z.number().int().min(0).optional(),
        languagesSpoken:   z.array(z.string()).optional(),
    }),
    acceptExisting: z.object({ token: z.string() }),
};

export const membershipController = {
    async lookupInvite(req, res) {
        const m = await inviteService.lookup({ token: req.params.token });
        res.json({
            organization: m.organization,
            kind: m.kind,
            inviteEmail: m.inviteEmail,
        });
    },

    async acceptInviteNew(req, res) {
        const { account, membership } = await inviteService.acceptWithNewAccount(req.body);

        const accessToken = tokenService.signAccessToken(account, membership.organization);
        const refreshToken = await tokenService.issueRefreshToken(account._id, {
            ip: req.ip, userAgent: req.get('user-agent'),
        });
        res.status(201).json({ accessToken, refreshToken });
    },

    async acceptInviteExisting(req, res) {
        const { account, membership } = await inviteService.acceptWithExistingAccount({
            token: req.body.token,
            accountId: req.actor.account._id,
        });
        // Re-issue token with new activeOrg
        const accessToken = tokenService.signAccessToken(account, membership.organization);
        res.json({ accessToken, membershipId: membership._id });
    },
};