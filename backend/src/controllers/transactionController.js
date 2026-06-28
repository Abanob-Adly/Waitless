import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';

export const transactionController = {
  async list(req, res) {
    const { orgId } = req.params;
    const { branchId, status, from, to, limit = 50, page = 1 } = req.query;

    const query = { org: new mongoose.Types.ObjectId(orgId) };
    if (branchId) query.branch = new mongoose.Types.ObjectId(branchId);
    if (status)   query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to)   query.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('branch', 'name')
        .lean(),
      Transaction.countDocuments(query),
    ]);

    res.json({ data: { transactions, total, page: Number(page), limit: Number(limit) } });
  },

  async summary(req, res) {
    const { orgId } = req.params;
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allTime, thisMonth] = await Promise.all([
      Transaction.aggregate([
        { $match: { org: orgObjectId } },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$commissionAmount' },
            pendingAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0] },
            },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { org: orgObjectId, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, thisMonthEarnings: { $sum: '$commissionAmount' } } },
      ]),
    ]);

    res.json({
      data: {
        totalEarnings:      allTime[0]?.totalEarnings      ?? 0,
        pendingAmount:      allTime[0]?.pendingAmount       ?? 0,
        thisMonthEarnings:  thisMonth[0]?.thisMonthEarnings ?? 0,
        currency:           'EGP',
      },
    });
  },
};
