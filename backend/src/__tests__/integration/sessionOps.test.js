/**
 * Integration tests: session start late-detection, capacity, and cash summary.
 *
 * Run: node --env-file=.env.test --test src/__tests__/integration/sessionOps.test.js
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { sessionService } from '../../services/sessionService.js';
import { queueService } from '../../services/queueService.js';
import Session from '../../models/QueueSession.js';
import Appointment from '../../models/Appointment.js';
import DoctorBranchSchedule from '../../models/DoctorBranchSchedule.js';
import { LATE_START_GRACE_MIN } from '../../config/fees.js';

const oid = () => new mongoose.Types.ObjectId();

async function makeSchedule(consultationFeeAmount = 200) {
  return DoctorBranchSchedule.create({
    organization:      oid(),
    branch:            oid(),
    doctorMembership:  oid(),
    specialty:         'General',
    schedule:          [],
    avgConsultationMin: 15,
    consultationFee:   { amount: consultationFeeAmount, currency: 'EGP' },
    status:            'active',
  });
}

async function makeSession(overrides = {}) {
  const schedule = await makeSchedule(overrides._fee ?? 200);
  return Session.create({
    doctorBranchSchedule: schedule._id,
    branch:               oid(),
    doctor:               oid(),
    startTime:            overrides.startTime ?? new Date(Date.now() - 30 * 60_000),
    endTime:              overrides.endTime   ?? new Date(Date.now() + 90 * 60_000),
    avgConsultationMin:   15,
    status:               overrides.status ?? 'scheduled',
    bookingsCount:        overrides.bookingsCount ?? 0,
    currentServing:       0,
    globalDelayMin:       overrides.globalDelayMin ?? 0,
    ...overrides,
  });
}

async function makeAppt(session, queueNumber, status = 'booked', paymentMethod = null) {
  return Appointment.create({
    session:          session._id,
    patientProfile:   oid(),
    organization:     oid(),
    branch:           session.branch,
    doctorMembership: session.doctor,
    queueNumber,
    status,
    source:           'walk_in',
    paymentMethod,
  });
}

before(connect);
after(disconnect);
beforeEach(clearAll);

// ── Late-start detection ──────────────────────────────────────────────────────

describe('sessionService.startSession — late-start detection', () => {
  it('adds overdue minutes to globalDelayMin when session starts late', async () => {
    const thirtyMinLate = new Date(Date.now() - 30 * 60_000);
    const session = await makeSession({
      startTime: thirtyMinLate,
      status: 'scheduled',
    });

    const started = await sessionService.startSession({ session });

    assert.ok(started.lateStartMin > 0, 'lateStartMin should be set');
    assert.ok(started.globalDelayMin >= 30, 'globalDelayMin should accumulate late minutes');
    assert.equal(started.status, 'active');
  });

  it('does not modify globalDelayMin when session starts on time', async () => {
    const fiveSecondsAgo = new Date(Date.now() - 5_000); // still within 1-min rounding
    const session = await makeSession({
      startTime: new Date(Date.now() + 5_000), // starts 5s in the future (on time)
      status: 'scheduled',
      globalDelayMin: 0,
    });

    const started = await sessionService.startSession({ session });

    assert.equal(started.lateStartMin ?? 0, 0, 'lateStartMin should be 0 for on-time start');
    assert.equal(started.globalDelayMin, 0, 'globalDelayMin unchanged for on-time start');
  });

  it('accumulates on top of existing globalDelayMin', async () => {
    const thirtyMinLate = new Date(Date.now() - 30 * 60_000);
    const session = await makeSession({
      startTime: thirtyMinLate,
      status: 'scheduled',
      globalDelayMin: 10, // pre-existing delay
    });

    const started = await sessionService.startSession({ session });

    assert.ok(started.globalDelayMin >= 40, 'should be pre-existing 10 + late 30 = 40+');
  });

  it('rejects starting an already-active session', async () => {
    const session = await makeSession({ status: 'active' });

    await assert.rejects(
      () => sessionService.startSession({ session }),
      /not in scheduled state/i,
    );
  });
});

// ── sessionAutoStart cron query ────────────────────────────────────────────────

describe('sessionAutoStart cron logic', () => {
  it('selects a scheduled session whose startTime has passed and endTime has not', async () => {
    const session = await makeSession({
      status:    'scheduled',
      startTime: new Date(Date.now() - 5 * 60_000),
      endTime:   new Date(Date.now() + 55 * 60_000),
    });

    const due = await Session.find({
      status:    'scheduled',
      startTime: { $lte: new Date() },
      endTime:   { $gt: new Date() },
    }).lean();

    assert.ok(due.some((s) => s._id.equals(session._id)), 'due session should be selected');
  });

  it('excludes a scheduled session whose endTime has already passed', async () => {
    const session = await makeSession({
      status:    'scheduled',
      startTime: new Date(Date.now() - 60 * 60_000),
      endTime:   new Date(Date.now() - 5 * 60_000),
    });

    const due = await Session.find({
      status:    'scheduled',
      startTime: { $lte: new Date() },
      endTime:   { $gt: new Date() },
    }).lean();

    assert.ok(!due.some((s) => s._id.equals(session._id)), 'lapsed session should be left to sessionAutoClose instead');
  });

  it('actually activates a due session when run through startSession', async () => {
    const session = await makeSession({
      status:    'scheduled',
      startTime: new Date(Date.now() - 1 * 60_000),
      endTime:   new Date(Date.now() + 59 * 60_000),
    });

    const started = await sessionService.startSession({ session });

    assert.equal(started.status, 'active');
  });

  it('~1 minute of auto-start cron jitter does not meet the lateStartPenalty threshold', async () => {
    const session = await makeSession({ status: 'active', lateStartMin: 1 });

    const flagged = await Session.find({
      status:       'active',
      lateStartMin: { $gt: LATE_START_GRACE_MIN },
    }).lean();

    assert.ok(!flagged.some((s) => s._id.equals(session._id)), '1 minute of lateness should not trigger a penalty');
  });

  it('a genuinely late start (past the grace period) does meet the lateStartPenalty threshold', async () => {
    const session = await makeSession({ status: 'active', lateStartMin: LATE_START_GRACE_MIN + 5 });

    const flagged = await Session.find({
      status:       'active',
      lateStartMin: { $gt: LATE_START_GRACE_MIN },
    }).lean();

    assert.ok(flagged.some((s) => s._id.equals(session._id)), 'genuinely late session should still be flagged');
  });
});

// ── checkDailyCapacity ────────────────────────────────────────────────────────

describe('queueService.checkDailyCapacity', () => {
  it('returns correct maxPatients from session times and avgConsultationMin', () => {
    const session = {
      startTime:          new Date('2026-01-01T08:00:00Z'),
      endTime:            new Date('2026-01-01T10:00:00Z'), // 2-hour shift
      avgConsultationMin: 15,
      bookingsCount:      3,
    };

    const result = queueService.checkDailyCapacity({ session });

    assert.equal(result.maxPatients,     8); // 120 / 15 = 8
    assert.equal(result.currentBookings, 3);
    assert.equal(result.remainingSlots,  5);
    assert.equal(result.isFull,          false);
  });

  it('shows isFull=true and remainingSlots=0 when at capacity', () => {
    const session = {
      startTime:          new Date('2026-01-01T08:00:00Z'),
      endTime:            new Date('2026-01-01T09:00:00Z'), // 1-hour shift → 4 slots
      avgConsultationMin: 15,
      bookingsCount:      4,
    };

    const result = queueService.checkDailyCapacity({ session });

    assert.equal(result.isFull,         true);
    assert.equal(result.remainingSlots, 0);
  });
});

// ── Cash summary ──────────────────────────────────────────────────────────────

describe('queueController.cashSummary — data queries', () => {
  it('counts only cash-paid completed appointments', async () => {
    const session = await makeSession({ status: 'active' });
    // These should be counted
    await makeAppt(session, 1, 'completed', 'cash');
    await makeAppt(session, 2, 'completed', 'cash');
    // These should NOT be counted
    await makeAppt(session, 3, 'completed', 'clinic');  // different payment method
    await makeAppt(session, 4, 'booked',    'cash');    // not completed yet

    const cashAppts = await Appointment.find({
      session:       session._id,
      status:        'completed',
      paymentMethod: 'cash',
    }).lean();

    assert.equal(cashAppts.length, 2, 'only 2 cash-completed appointments should be found');
  });

  it('returns empty list when no cash payments exist', async () => {
    const session = await makeSession({ status: 'active' });
    await makeAppt(session, 1, 'completed', 'clinic');
    await makeAppt(session, 2, 'completed', 'wallet');

    const cashAppts = await Appointment.find({
      session:       session._id,
      status:        'completed',
      paymentMethod: 'cash',
    }).lean();

    assert.equal(cashAppts.length, 0);
  });
});
