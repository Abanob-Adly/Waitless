import PatientProfile from '../models/PatientProfile.js';
import Appointment from '../models/Appointment.js';
import { NotFound } from '../utils/errors.js';

export const patientService = {
  async findOrCreateWalkIn({ orgId, branchId, phone, fullName }) {
    const profile = await PatientProfile.findOneAndUpdate(
      { organizationId: orgId, phone },
      { $setOnInsert: { fullName, branchId, accountId: null, organizationId: orgId, phone } },
      { upsert: true, new: true }
    );
    return profile;
  },

  async createProfile({ orgId, branchId, data }) {
    const profile = await PatientProfile.create({
      ...data,
      organizationId: orgId,
      branchId,
      accountId: null,
    });
    return profile;
  },

  async listProfiles({ orgId, filters }) {
    const query = { organizationId: orgId };
    if (filters.phone) query.phone = { $regex: filters.phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
    if (filters.name)  query.fullName = { $regex: filters.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const page  = Math.max(1, parseInt(filters.page  || 1));
    const limit = Math.min(100, parseInt(filters.limit || 20));

    return PatientProfile.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
  },

  async getProfile({ profile }) {
    return profile;
  },

  async updateProfile({ profile, data }) {
    const allowed = ['fullName', 'phone', 'gender', 'dateOfBirth', 'avatarUrl'];
    for (const k of allowed) if (data[k] !== undefined) profile[k] = data[k];
    await profile.save();
    return profile;
  },

  async getOwnProfile({ accountId }) {
    const profile = await PatientProfile.findOne({ accountId });
    if (!profile) throw NotFound('Patient profile not found');
    return profile;
  },

  async updateOwnProfile({ accountId, data }) {
    const profile = await PatientProfile.findOne({ accountId });
    if (!profile) throw NotFound('Patient profile not found');
    const allowed = ['fullName', 'phone', 'gender', 'dateOfBirth', 'avatarUrl'];
    for (const k of allowed) if (data[k] !== undefined) profile[k] = data[k];
    await profile.save();
    return profile;
  },

  async getPatientHistory({ profileId }) {
    return Appointment.find({ patientProfile: profileId })
      .populate('session')
      .sort({ createdAt: -1 })
      .limit(50);
  },
};
