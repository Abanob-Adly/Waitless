import mongoose from 'mongoose';
import Account from '../models/Account.js';
import { Membership } from '../models/Membership.js';
import { tokenService } from '../services/token.js';
import { Unauthorized } from '../utils/errors.js';

/**
 * Loads the actor context onto req.actor so downstream code never has to query auth again.
 *
 * req.actor = {
 *   account,                  // full Account doc
 *   activeOrgId,              // ObjectId or null
 *   activeMembership,         // full Membership doc (with discriminator) or null
 *   orgMemberships,           // ALL of this account's active memberships in activeOrg
 *   isPlatformAdmin,          // boolean
 * }
 */
export async function authenticate(req, _res, next) {
    try {
        // Accept token from Authorization header OR ?token= query param (for SSE / EventSource)
        const header = req.headers.authorization;
        const rawToken = (header?.startsWith('Bearer ') ? header.slice(7) : null)
            ?? (typeof req.query.token === 'string' ? req.query.token : null);
        if (!rawToken) throw Unauthorized();

        const payload = tokenService.verifyAccessToken(rawToken);

        const account = await Account.findById(payload.sub);
        if (!account || account.status !== 'active') throw Unauthorized('Account inactive');

        let activeMembership = null;
        let orgMemberships = [];
        if (payload.activeOrg) {
            orgMemberships = await Membership.find({
                account: account._id,
                organization: payload.activeOrg,
                status: 'active',
                // Sort by kind ascending (admin < doctor < receptionist) so that when a user
                // holds multiple roles the highest-privilege one is consistently first.
            }).sort({ kind: 1 });
            if (orgMemberships.length === 0) throw Unauthorized('Org membership invalid');
            activeMembership = orgMemberships[0];
        }

        req.actor = {
            account,
            // Must be an ObjectId so policies can call .equals() on it
            activeOrgId: payload.activeOrg
                ? new mongoose.Types.ObjectId(payload.activeOrg)
                : null,
            activeMembership,
            // A dual-role account (e.g. clinic owner who is also a practicing
            // doctor) always resolves activeMembership to its highest-privilege
            // role (admin). Ownership checks that need "is this account
            // *specifically* the doctor referenced on this resource" — not
            // "whichever role is currently active" — must check across every
            // membership the account holds, not just activeMembership.
            orgMemberships,
            isPlatformAdmin: account.role === 'super_admin',
        };

        next();
    } catch (err) {
        next(err.status ? err : Unauthorized());
    }
}

/**
 * Optional auth — sets req.actor if a token is present, but doesn't reject if missing.
 * Use on public endpoints that show extra info to logged-in users.
 */
export async function optionalAuthenticate(req, res, next) {
    if (!req.headers.authorization) return next();
    return authenticate(req, res, next);
}