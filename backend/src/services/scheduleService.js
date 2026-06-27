import DoctorBranchSchedule from '../models/DoctorBranchSchedule.js';
import ScheduleException from '../models/ScheduleException.js';
import { Membership } from '../models/Membership.js';
import Branch from '../models/Branch.js';
import { Conflict, Forbidden, NotFound } from '../utils/errors.js';

export const scheduleService = {
  async createSchedule({ orgId, data }) {
    const doctor = await Membership.findOne({
      _id:          data.doctorMembershipId,
      organization: orgId,
      kind:         'doctor',
      status:       'active',
    });
    if (!doctor) throw NotFound('Doctor membership not found in this organization');

    const branch = await Branch.findOne({ _id: data.branchId, organization: orgId, isActive: true });
    if (!branch) throw NotFound('Branch not found in this organization');

    try {
      const schedule = await DoctorBranchSchedule.create({
        doctorMembership:   doctor._id,
        organization:       orgId,
        branch:             branch._id,
        schedule:           data.schedule,
        avgConsultationMin: data.avgConsultationMin,
        consultationFee:    data.consultationFee,
        status:             'active',
      });
      return schedule;
    } catch (err) {
      if (err.code === 11000) throw Conflict('An active schedule already exists for this doctor and branch');
      throw err;
    }
  },

  async listSchedules({ orgId, filters }) {
    const query = { organization: orgId };
    if (filters.branchId)          query.branch           = filters.branchId;
    if (filters.doctorMembershipId) query.doctorMembership = filters.doctorMembershipId;
    if (filters.status)            query.status           = filters.status;
    else                           query.status           = 'active';

    return DoctorBranchSchedule.find(query)
      .populate({ path: 'doctorMembership', select: 'kind specialties', populate: { path: 'account', select: 'fullName' } })
      .populate('branch', 'name');
  },

  async updateSchedule({ schedule, data }) {
    if (data.schedule           !== undefined) schedule.schedule           = data.schedule;
    if (data.avgConsultationMin !== undefined) schedule.avgConsultationMin = data.avgConsultationMin;
    if (data.consultationFee    !== undefined) schedule.consultationFee    = data.consultationFee;
    if (data.status             !== undefined) schedule.status             = data.status;
    await schedule.save();
    return schedule;
  },

  async deleteSchedule({ schedule }) {
    schedule.status = 'inactive';
    await schedule.save();
    return { ok: true };
  },

  async createException({ schedule, data, actorAccountId }) {
    const date = new Date(data.date);
    date.setUTCHours(0, 0, 0, 0);

    try {
      const exception = await ScheduleException.create({
        doctorBranchSchedule: schedule._id,
        date,
        reason:    data.reason || 'other',
        note:      data.note,
        createdBy: actorAccountId,
      });

      // Cancel any scheduled session for this date/schedule
      const Session = (await import('../models/QueueSession.js')).default;
      const dayStart = new Date(date);
      const dayEnd   = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      await Session.updateMany(
        {
          doctorBranchSchedule: schedule._id,
          startTime: { $gte: dayStart, $lt: dayEnd },
          status: 'scheduled',
        },
        { $set: { status: 'cancelled' } }
      );

      return exception;
    } catch (err) {
      if (err.code === 11000) throw Conflict('An exception already exists for this date');
      throw err;
    }
  },

  async listExceptions({ scheduleId, filters }) {
    const query = { doctorBranchSchedule: scheduleId };
    if (filters.fromDate) query.date = { ...query.date, $gte: new Date(filters.fromDate) };
    if (filters.toDate)   query.date = { ...query.date, $lt:  new Date(filters.toDate) };
    return ScheduleException.find(query).sort({ date: 1 });
  },

  async deleteException({ exception }) {
    await exception.deleteOne();
    return { ok: true };
  },
};
