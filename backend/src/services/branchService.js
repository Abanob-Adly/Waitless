import Branch from '../models/Branch.js';
import Subscription from '../models/Subscription.js';
import { Forbidden, NotFound } from '../utils/errors.js';

export const branchService = {
  async createBranch({ orgId, actor, data }) {
    const sub = await Subscription.findOne({
      organization: orgId,
      state: { $in: ['trial', 'active', 'past_due'] },
    }).populate('plan');

    if (sub?.plan?.limits?.maxBranches != null) {
      const count = await Branch.countDocuments({ organization: orgId, isActive: true });
      if (count >= sub.plan.limits.maxBranches) {
        throw Forbidden('Branch limit reached for your plan');
      }
    }

    const branch = await Branch.create({ ...data, organization: orgId });
    return branch;
  },

  async listBranches({ orgId, isOrgMember, includeInactive }) {
    const query = { organization: orgId };
    if (!isOrgMember || !includeInactive) query.isActive = true;
    return Branch.find(query);
  },

  async getBranch({ branch }) {
    return branch;
  },

  async updateBranch({ branch, data }) {
    Object.assign(branch, data);
    await branch.save();
    return branch;
  },

  async deleteBranch({ branch }) {
    branch.isActive = false;
    await branch.save();
    return { ok: true };
  },
};
