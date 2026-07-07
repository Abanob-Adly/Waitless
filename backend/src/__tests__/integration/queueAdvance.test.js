/**
 * Integration tests: cancelling/no-showing/skipping the currently-served
 * appointment must auto-advance the queue via queueService.callNext, mirroring
 * the existing holdPatient behavior.
 *
 * Run: node --env-file=.env.test --test src/__tests__/integration/queueAdvance.test.js
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { queueService } from '../../services/queueService.js';
import { appointmentService } from '../../services/appointmentService.js';
import Appointment from '../../models/Appointment.js';
import Session from '../../models/QueueSession.js';

const oid = () => new mongoose.Types.ObjectId();

async function makeSession(overrides = {}) {
  return Session.create({
    doctorBranchSchedule: oid(),
    branch:               oid(),
    doctor:               oid(),
    startTime:            new Date(Date.now() - 60 * 60_000),
    endTime:              new Date(Date.now() + 60 * 60_000),
    avgConsultationMin:   15,
    status:               'active',
    bookingsCount:        0,
    currentServing:       0,
    ...overrides,
  });
}

async function makeAppt(session, queueNumber, status = 'booked') {
  return Appointment.create({
    session:          session._id,
    patientProfile:   oid(),
    organization:     oid(),
    branch:           session.branch,
    doctorMembership: session.doctor,
    queueNumber,
    status,
    source:           'walk_in',
  });
}

before(connect);
after(disconnect);
beforeEach(clearAll);

describe('cancelling the currently-served appointment advances the queue', () => {
  it('appointmentService.cancelAppointment auto-calls the next patient', async () => {
    const session = await makeSession({ currentServing: 1 });
    const p1 = await makeAppt(session, 1, 'called');
    const p2 = await makeAppt(session, 2, 'booked');

    await appointmentService.cancelAppointment({ appointment: p1, reason: 'test', patientAccountId: null });

    const [a1, a2, updatedSession] = await Promise.all([
      Appointment.findById(p1._id).lean(),
      Appointment.findById(p2._id).lean(),
      Session.findById(session._id).lean(),
    ]);

    assert.equal(a1.status, 'cancelled');
    assert.equal(a2.status, 'called', 'next booked patient should be auto-called');
    assert.equal(updatedSession.currentServing, 2, 'currentServing should advance to the next patient');
  });

  it('queueService.updateAppointmentStatus(no_show) auto-calls the next patient', async () => {
    const session = await makeSession({ currentServing: 1 });
    const p1 = await makeAppt(session, 1, 'called');
    const p2 = await makeAppt(session, 2, 'booked');

    await queueService.updateAppointmentStatus({ appointment: p1, session, newStatus: 'no_show' });

    const [a2, updatedSession] = await Promise.all([
      Appointment.findById(p2._id).lean(),
      Session.findById(session._id).lean(),
    ]);

    assert.equal(a2.status, 'called');
    assert.equal(updatedSession.currentServing, 2);
  });

  it('queueService.updateAppointmentStatus(skipped) re-triggers callNext instead of leaving currentServing stuck', async () => {
    // callNext() prioritizes the oldest 'skipped' appointment over fresh 'booked'
    // ones (queueService.js callNext, lines 121-131) — so skipping the currently
    // served patient (who becomes the only 'skipped' entry) re-calls that same
    // patient rather than jumping to p2. That's pre-existing callNext ordering,
    // not something this fix changes; the point of this test is only to confirm
    // callNext actually runs (currentServing gets refreshed, not left dangling)
    // instead of staying stuck on the appointment that just moved to 'skipped'.
    const session = await makeSession({ currentServing: 1 });
    const p1 = await makeAppt(session, 1, 'called');
    const p2 = await makeAppt(session, 2, 'booked');

    await queueService.updateAppointmentStatus({ appointment: p1, session, newStatus: 'skipped' });

    const [a1, a2, updatedSession] = await Promise.all([
      Appointment.findById(p1._id).lean(),
      Appointment.findById(p2._id).lean(),
      Session.findById(session._id).lean(),
    ]);

    assert.equal(a1.status, 'called', 'the only skipped patient gets re-called by callNext');
    assert.equal(a2.status, 'booked', 'p2 is untouched since p1 took priority');
    assert.equal(updatedSession.currentServing, 1);
  });

  it('cancelling a not-yet-called booked appointment does not advance currentServing', async () => {
    const session = await makeSession({ currentServing: 1 });
    await makeAppt(session, 1, 'called');
    const p2 = await makeAppt(session, 2, 'booked');

    await appointmentService.cancelAppointment({ appointment: p2, reason: 'test', patientAccountId: null });

    const [a2, updatedSession] = await Promise.all([
      Appointment.findById(p2._id).lean(),
      Session.findById(session._id).lean(),
    ]);

    assert.equal(a2.status, 'cancelled');
    assert.equal(updatedSession.currentServing, 1, 'currentServing should not move for a not-yet-served cancellation');
  });

  it('cancelling the only served patient with nobody left does not error', async () => {
    const session = await makeSession({ currentServing: 1 });
    const p1 = await makeAppt(session, 1, 'called');

    await assert.doesNotReject(() =>
      appointmentService.cancelAppointment({ appointment: p1, reason: 'test', patientAccountId: null }),
    );

    const a1 = await Appointment.findById(p1._id).lean();
    assert.equal(a1.status, 'cancelled');
  });
});
