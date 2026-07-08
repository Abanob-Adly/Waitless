/**
 * Integration tests: an already-started 'active' session with open slots
 * must stay bookable through the marketplace until it fills up or ends —
 * not disappear the moment its scheduled startTime passes.
 *
 * Run: node --env-file=.env.test --test src/__tests__/integration/marketplaceAvailability.test.js
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { marketplaceService } from '../../services/marketplaceService.js';
import Session from '../../models/QueueSession.js';
import Branch from '../../models/Branch.js';
import DoctorBranchSchedule from '../../models/DoctorBranchSchedule.js';
import { wallClockNow } from '../../utils/wallClockNow.js';

// getAvailableSessions compares stored startTime/endTime (local wall-clock
// digits written with a UTC label — see wallClockNow.js) against wallClockNow(),
// not a genuine UTC instant. Fixtures must use the same reference point, or
// they'd be off by this server's UTC offset and the assertions would be
// testing nothing meaningful on any machine that isn't itself running in UTC.
function minutesFromNow(mins) {
  return new Date(wallClockNow().getTime() + mins * 60_000);
}

const oid = () => new mongoose.Types.ObjectId();

async function makeBranch() {
  return Branch.create({ organization: oid(), name: 'Test Branch', isActive: true });
}

async function makeSchedule(branch, doctorMembership) {
  return DoctorBranchSchedule.create({
    organization:       branch.organization,
    branch:             branch._id,
    doctorMembership,
    specialty:          'General',
    schedule:           [],
    avgConsultationMin: 15,
    consultationFee:    { amount: 200, currency: 'EGP' },
    status:             'active',
  });
}

before(connect);
after(disconnect);
beforeEach(clearAll);

describe('marketplaceService.getAvailableSessions — booking window', () => {
  it('still lists an already-started active session as bookable', async () => {
    const doctorMembership = oid();
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch, doctorMembership);
    const session = await Session.create({
      doctorBranchSchedule: schedule._id,
      branch:               branch._id,
      doctor:               doctorMembership,
      startTime:            minutesFromNow(-30), // started 30 min ago
      endTime:              minutesFromNow(30),  // still 30 min left
      avgConsultationMin:   15,
      status:               'active',
      bookingsCount:        1,
      currentServing:       1,
    });

    const sessions = await marketplaceService.getAvailableSessions({ orgId: String(branch.organization) });

    assert.ok(
      sessions.some((s) => s._id.equals(session._id)),
      'an active session with time remaining should still be bookable',
    );
  });

  it('excludes an active session whose window has already ended', async () => {
    const doctorMembership = oid();
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch, doctorMembership);
    const session = await Session.create({
      doctorBranchSchedule: schedule._id,
      branch:               branch._id,
      doctor:               doctorMembership,
      startTime:            minutesFromNow(-90),
      endTime:              minutesFromNow(-5), // ended 5 min ago
      avgConsultationMin:   15,
      status:               'active',
      bookingsCount:        1,
      currentServing:       1,
    });

    const sessions = await marketplaceService.getAvailableSessions({ orgId: String(branch.organization) });

    assert.ok(
      !sessions.some((s) => s._id.equals(session._id)),
      'a session past its end time should not be offered for booking',
    );
  });

  it('still lists an upcoming scheduled session', async () => {
    const doctorMembership = oid();
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch, doctorMembership);
    const session = await Session.create({
      doctorBranchSchedule: schedule._id,
      branch:               branch._id,
      doctor:               doctorMembership,
      startTime:            minutesFromNow(60),
      endTime:              minutesFromNow(120),
      avgConsultationMin:   15,
      status:               'scheduled',
      bookingsCount:        0,
      currentServing:       0,
    });

    const sessions = await marketplaceService.getAvailableSessions({ orgId: String(branch.organization) });

    assert.ok(sessions.some((s) => s._id.equals(session._id)));
  });
});
