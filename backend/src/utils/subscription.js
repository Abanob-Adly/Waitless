import Subscription from '../models/Subscription.js';

const ACTIVE_STATES = ['trial', 'active', 'past_due'];

/**
 * Returns the org's active subscription (with plan populated), or null if none.
 * Centralised so callers don't need to know the active-state set.
 */
export async function getActiveSubscription(orgId) {
  return Subscription.findOne({
    organization: orgId,
    state: { $in: ACTIVE_STATES },
  }).populate('plan');
}
