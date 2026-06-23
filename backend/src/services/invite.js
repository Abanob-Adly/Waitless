import  { Membership } from '../models/membership.js';
import  Account    from '../models/account.js';
import { hashPassword } from '../utils/password.js';
import { AppError, Conflict, Forbidden, NotFound } from '../utils/errors.js';

export const inviteService = {
  /**
   * Step 1: Look up an invite by token (used by the accept page to show
   * "You've been invited to <Org> as a <role>")
   */
  async lookup({ token }) {
    const membership = await Membership.findOne({
      inviteToken: token,
      status: 'pending',
    }).populate('organization', 'name slug');

    if (!membership) throw NotFound('Invite not found');
    if (membership.inviteExpiresAt < new Date()) throw new AppError('Invite expired', 410);

    return membership;
  },

  /**
   * Step 2a: Invitee has no account → sign up + accept atomically.
   */
  async acceptWithNewAccount({ token, fullName, password, phone, preferredLanguage = 'ar' }) {
    const membership = await this.lookup({ token });

    if (await Account.findOne({ email: membership.inviteEmail })) {
      throw Conflict('Account already exists — please log in and accept the invite');
    }

    const account = await Account.create({
      email:        membership.inviteEmail,
      phone, fullName,
      passwordHash: await hashPassword(password),
      role:         'staff',
      preferredLanguage,
      status:       'active',         // accepting an invite implicitly verifies email
      isEmailVerified: true,
    });

    return this._finalizeAccept({ membership, account });
  },

  /**
   * Step 2b: Invitee already has an account → just accept.
   */
  async acceptWithExistingAccount({ token, accountId }) {
    const membership = await this.lookup({ token });
    const account = await Account.findById(accountId);

    if (!account) throw NotFound('Account not found');
    if (account.email !== membership.inviteEmail) {
      throw Forbidden('This invite was sent to a different email');
    }

    return this._finalizeAccept({ membership, account });
  },

  async _finalizeAccept({ membership, account }) {
    membership.account         = account._id;
    membership.status          = 'active';
    membership.acceptedAt      = new Date();
    membership.inviteToken     = null;
    membership.inviteExpiresAt = null;
    await membership.save();

    return { membership, account };
  },
};