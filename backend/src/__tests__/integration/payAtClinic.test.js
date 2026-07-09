/**
 * Integration tests: "pay at clinic" bookings join the real queue
 * immediately (status 'booked'), staying unpaid (paymentStatus 'pending')
 * until a receptionist/doctor confirms the cash payment.
 *
 * A older behavior (kept for backward compatibility with any already-existing
 * records) held these out of the queue as 'pending_confirmation' until
 * confirmed — see the "legacy pending_confirmation records" block below.
 *
 * Run: node --env-file=.env.test --test src/__tests__/integration/payAtClinic.test.js
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { marketplaceService } from '../../services/marketplaceService.js';
import { appointmentController } from '../../controllers/appointmentController.js';
import Appointment from '../../models/Appointment.js';
import Session from '../../models/QueueSession.js';
import Branch from '../../models/Branch.js';
import DoctorBranchSchedule from '../../models/DoctorBranchSchedule.js';

const oid = () => new mongoose.Types.ObjectId();

async function makeBranch() {
  return Branch.create({ organization: oid(), name: 'Test Branch' });
}

async function makeSchedule(branch) {
  return DoctorBranchSchedule.create({
    organization:       branch.organization,
    branch:             branch._id,
    doctorMembership:   oid(),
    specialty:          'General',
    schedule:           [],
    avgConsultationMin: 15,
    consultationFee:    { amount: 200, currency: 'EGP' },
    status:             'active',
  });
}

async function makeSession(branch, schedule, overrides = {}) {
  return Session.create({
    doctorBranchSchedule: schedule._id,
    branch:               branch._id,
    doctor:               schedule.doctorMembership,
    startTime:            new Date(Date.now() - 60 * 60_000),
    endTime:              new Date(Date.now() + 60 * 60_000),
    avgConsultationMin:   15,
    status:               'active',
    bookingsCount:        0,
    currentServing:       0,
    ...overrides,
  });
}

function makeActor(phone = '+201012345678') {
  return {
    account: { _id: oid(), fullName: 'Test Patient', phone },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

before(connect);
after(disconnect);
beforeEach(clearAll);

describe('bookMarketplace — pay-at-clinic joins the queue immediately, unpaid', () => {
  it('creates a booked appointment (in the real queue) with paymentStatus pending for paymentMethod "clinic"', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session = await makeSession(branch, schedule);

    const { appointment } = await marketplaceService.bookMarketplace({
      actor: makeActor(),
      sessionId: session._id,
      paymentMethod: 'clinic',
    });

    assert.equal(appointment.status, 'booked');
    assert.equal(appointment.paymentMethod, 'clinic');
    assert.equal(appointment.paymentStatus, 'pending');
  });

  it('still books immediately (unchanged behavior) for other payment methods', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session = await makeSession(branch, schedule);

    const { appointment } = await marketplaceService.bookMarketplace({
      actor: makeActor(),
      sessionId: session._id,
      paymentMethod: 'paymob',
    });

    assert.equal(appointment.status, 'booked');
    assert.equal(appointment.paymentMethod, 'paymob');
  });

  it('a pay-at-clinic appointment appears in the active queue right away, unpaid', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session = await makeSession(branch, schedule);

    await marketplaceService.bookMarketplace({
      actor: makeActor('+201012345679'),
      sessionId: session._id,
      paymentMethod: 'clinic',
    });

    const activeQueue = await Appointment.find({
      session: session._id,
      status: { $in: ['booked', 'called', 'held', 'skipped', 'in_progress'] },
    }).lean();
    assert.equal(activeQueue.length, 1, 'pay-at-clinic appointment must join the active queue immediately');
    assert.equal(activeQueue[0].paymentStatus, 'pending');
  });
});

describe('bookMarketplace — concurrent unpaid pay-at-clinic cap', () => {
  it('allows a patient to hold 2 unpaid clinic bookings across different sessions', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session1 = await makeSession(branch, schedule);
    const session2 = await makeSession(branch, schedule);
    const actor = makeActor();

    await marketplaceService.bookMarketplace({ actor, sessionId: session1._id, paymentMethod: 'clinic' });
    const { appointment } = await marketplaceService.bookMarketplace({ actor, sessionId: session2._id, paymentMethod: 'clinic' });

    assert.equal(appointment.status, 'booked');
    assert.equal(appointment.paymentStatus, 'pending');
  });

  it('rejects a 3rd concurrent unpaid clinic booking for the same patient', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session1 = await makeSession(branch, schedule);
    const session2 = await makeSession(branch, schedule);
    const session3 = await makeSession(branch, schedule);
    const actor = makeActor();

    await marketplaceService.bookMarketplace({ actor, sessionId: session1._id, paymentMethod: 'clinic' });
    await marketplaceService.bookMarketplace({ actor, sessionId: session2._id, paymentMethod: 'clinic' });

    await assert.rejects(
      () => marketplaceService.bookMarketplace({ actor, sessionId: session3._id, paymentMethod: 'clinic' }),
      /2 unpaid pay-at-clinic bookings/,
    );
  });

  it('does not count paymob (online-paid) bookings toward the clinic cap', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session1 = await makeSession(branch, schedule);
    const session2 = await makeSession(branch, schedule);
    const session3 = await makeSession(branch, schedule);
    const actor = makeActor();

    await marketplaceService.bookMarketplace({ actor, sessionId: session1._id, paymentMethod: 'paymob' });
    await marketplaceService.bookMarketplace({ actor, sessionId: session2._id, paymentMethod: 'clinic' });

    const { appointment } = await marketplaceService.bookMarketplace({ actor, sessionId: session3._id, paymentMethod: 'clinic' });
    assert.equal(appointment.status, 'booked');
  });

  it('a 3rd clinic booking succeeds once one of the first 2 has been paid/confirmed', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session1 = await makeSession(branch, schedule);
    const session2 = await makeSession(branch, schedule);
    const session3 = await makeSession(branch, schedule);
    const actor = makeActor();

    const first = await marketplaceService.bookMarketplace({ actor, sessionId: session1._id, paymentMethod: 'clinic' });
    await marketplaceService.bookMarketplace({ actor, sessionId: session2._id, paymentMethod: 'clinic' });

    const req = { resource: first.appointment, body: {}, actor: { activeMembership: { _id: oid() } } };
    await appointmentController.confirmPayment(req, makeRes());

    const { appointment } = await marketplaceService.bookMarketplace({ actor, sessionId: session3._id, paymentMethod: 'clinic' });
    assert.equal(appointment.status, 'booked');
  });
});

describe('appointmentController.confirmPayment — marking a queued pay-at-clinic ticket as paid', () => {
  it('flips paymentStatus to success without touching queue membership (already booked)', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session = await makeSession(branch, schedule);
    const { appointment } = await marketplaceService.bookMarketplace({
      actor: makeActor(),
      sessionId: session._id,
      paymentMethod: 'clinic',
    });

    const req = {
      resource: appointment,
      body: {},
      actor: { activeMembership: { _id: oid() } },
    };
    const res = makeRes();
    await appointmentController.confirmPayment(req, res);

    const updated = await Appointment.findById(appointment._id).lean();
    assert.equal(updated.status, 'booked', 'was already in the queue — status is unaffected');
    assert.equal(updated.paymentStatus, 'success');
    assert.ok(updated.paidAt);
  });

  it('confirming payment succeeds even after the session has ended (already-queued ticket, not a new join)', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session = await makeSession(branch, schedule);
    const { appointment } = await marketplaceService.bookMarketplace({
      actor: makeActor(),
      sessionId: session._id,
      paymentMethod: 'clinic',
    });
    await Session.findByIdAndUpdate(session._id, { $set: { status: 'ended' } });

    const req = {
      resource: appointment,
      body: {},
      actor: { activeMembership: { _id: oid() } },
    };
    const res = makeRes();
    await appointmentController.confirmPayment(req, res);

    assert.equal(res.statusCode, 200);
    const updated = await Appointment.findById(appointment._id).lean();
    assert.equal(updated.paymentStatus, 'success');
  });

  it('does not change status for an already-booked clinic appointment (existing cash-at-checkout flow)', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session = await makeSession(branch, schedule);
    const { appointment } = await marketplaceService.bookMarketplace({
      actor: makeActor(),
      sessionId: session._id,
      paymentMethod: 'paymob', // starts as 'booked'
    });
    appointment.paymentMethod = 'clinic'; // simulate a walk-in clinic-pay appointment already in the queue
    await appointment.save();

    const req = {
      resource: appointment,
      body: {},
      actor: { activeMembership: { _id: oid() } },
    };
    const res = makeRes();
    await appointmentController.confirmPayment(req, res);

    const updated = await Appointment.findById(appointment._id).lean();
    assert.equal(updated.status, 'booked', 'status must stay booked, not be touched');
    assert.equal(updated.paymentStatus, 'success');
  });
});

describe('appointmentController.confirmPayment — legacy pending_confirmation records', () => {
  it('still transitions an old-style pending_confirmation appointment to booked on confirm', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session = await makeSession(branch, schedule);
    const appointment = await Appointment.create({
      session: session._id, patientProfile: oid(), organization: branch.organization,
      branch: branch._id, doctorMembership: schedule.doctorMembership, queueNumber: 1,
      status: 'pending_confirmation', source: 'marketplace', paymentMethod: 'clinic',
    });

    const req = { resource: appointment, body: {}, actor: { activeMembership: { _id: oid() } } };
    const res = makeRes();
    await appointmentController.confirmPayment(req, res);

    const updated = await Appointment.findById(appointment._id).lean();
    assert.equal(updated.status, 'booked');
    assert.equal(updated.paymentStatus, 'success');
  });

  it('rejects joining a session that already ended, for a legacy pending_confirmation record', async () => {
    const branch = await makeBranch();
    const schedule = await makeSchedule(branch);
    const session = await makeSession(branch, schedule, { status: 'ended' });
    const appointment = await Appointment.create({
      session: session._id, patientProfile: oid(), organization: branch.organization,
      branch: branch._id, doctorMembership: schedule.doctorMembership, queueNumber: 1,
      status: 'pending_confirmation', source: 'marketplace', paymentMethod: 'clinic',
    });

    const req = { resource: appointment, body: {}, actor: { activeMembership: { _id: oid() } } };
    const res = makeRes();
    await appointmentController.confirmPayment(req, res);

    assert.equal(res.statusCode, 409);
    const updated = await Appointment.findById(appointment._id).lean();
    assert.equal(updated.status, 'pending_confirmation', 'should not join a dead session');
  });
});
