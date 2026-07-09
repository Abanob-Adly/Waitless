/**
 * Integration tests: forceInsert queue-shifting algorithm.
 *
 * Uses mongodb-memory-server for an isolated in-memory DB.
 * Redis is intentionally NOT mocked — queueService wraps every Redis call
 * in try/catch and falls back to DB reads on error, so a missing Redis
 * server is a gracefully handled non-issue in tests.
 *
 * Run: node --env-file=.env.test --test src/__tests__/integration/forceInsert.test.js
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { queueService } from '../../services/queueService.js';
import Appointment from '../../models/Appointment.js';
import Session from '../../models/QueueSession.js';

// ── Factories ─────────────────────────────────────────────────────────────────

const oid = () => new mongoose.Types.ObjectId();

async function makeSession(overrides = {}) {
  return Session.create({
    doctorBranchSchedule: oid(),
    branch:               oid(),
    doctor:               oid(),
    startTime:            new Date('2026-01-01T09:00:00Z'),
    endTime:              new Date('2026-01-01T11:00:00Z'),
    avgConsultationMin:   15,
    status:               'active',
    bookingsCount:        0,
    currentServing:       1,
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

// ── Lifecycle ─────────────────────────────────────────────────────────────────

before(connect);
after(disconnect);
beforeEach(clearAll);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('queueService.forceInsert — queue shifting', () => {
  it('moves a later patient to position currentServing+1 and shifts intermediates', async () => {
    // Queue: #1(called), #2, #3, #4 — force-insert #4
    const session = await makeSession({ currentServing: 1 });
    await makeAppt(session, 1, 'called');
    const p2 = await makeAppt(session, 2);
    const p3 = await makeAppt(session, 3);
    const p4 = await makeAppt(session, 4);

    await queueService.forceInsert({ appointment: p4, session });

    const [a4, a2, a3] = await Promise.all([
      Appointment.findById(p4._id).lean(),
      Appointment.findById(p2._id).lean(),
      Appointment.findById(p3._id).lean(),
    ]);

    assert.equal(a4.queueNumber, 2, 'force-inserted patient should be at position 2');
    assert.equal(a4.wasForceInserted, true);
    assert.equal(a2.queueNumber, 3, 'p2 should shift 2→3');
    assert.equal(a3.queueNumber, 4, 'p3 should shift 3→4');
  });

  it('is a no-op when the patient is already immediately next', async () => {
    const session = await makeSession({ currentServing: 1 });
    await makeAppt(session, 1, 'called');
    const p2 = await makeAppt(session, 2);
    const p3 = await makeAppt(session, 3);

    await queueService.forceInsert({ appointment: p2, session });

    const [a2, a3] = await Promise.all([
      Appointment.findById(p2._id).lean(),
      Appointment.findById(p3._id).lean(),
    ]);
    assert.equal(a2.queueNumber, 2, 'already-next patient stays at 2');
    assert.equal(a3.queueNumber, 3, 'p3 remains unchanged');
  });

  it('stores emergencyReason when provided', async () => {
    const session = await makeSession({ currentServing: 1 });
    await makeAppt(session, 1, 'called');
    const p3 = await makeAppt(session, 3);

    await queueService.forceInsert({ appointment: p3, session, emergencyReason: 'Chest pain' });

    const a3 = await Appointment.findById(p3._id).lean();
    assert.equal(a3.emergencyReason, 'Chest pain');
    assert.equal(a3.wasForceInserted, true);
  });

  it('does NOT shift completed or cancelled appointments', async () => {
    const session = await makeSession({ currentServing: 1 });
    await makeAppt(session, 1, 'called');
    const done = await makeAppt(session, 2, 'completed');
    const p3 = await makeAppt(session, 3);
    const p5 = await makeAppt(session, 5);

    await queueService.forceInsert({ appointment: p5, session });

    const [aDone, a5] = await Promise.all([
      Appointment.findById(done._id).lean(),
      Appointment.findById(p5._id).lean(),
    ]);
    assert.equal(aDone.queueNumber, 2, 'completed patient should NOT shift');
    assert.equal(a5.queueNumber, 2,   'force-inserted patient lands at currentServing+1');

    const a3 = await Appointment.findById(p3._id).lean();
    assert.equal(a3.queueNumber, 4, 'p3 shifts 3→4');
  });

  it('rejects a non-booked (cancelled) appointment', async () => {
    const session = await makeSession({ currentServing: 1 });
    const p = await makeAppt(session, 2, 'cancelled');

    await assert.rejects(
      () => queueService.forceInsert({ appointment: p, session }),
      /Only booked appointments/,
    );
  });

  it('rejects an appointment at or before currentServing', async () => {
    const session = await makeSession({ currentServing: 3 });
    const p = await makeAppt(session, 3);

    await assert.rejects(
      () => queueService.forceInsert({ appointment: p, session }),
      /already in progress or past/,
    );
  });
});

describe('queueService.callNext — force-inserted patient outranks a stale skipped one', () => {
  it('calls the urgent (force-inserted) patient even when an older skipped patient is waiting', async () => {
    // #1 was skipped earlier this session and is still waiting to be re-called.
    // #2 is currently being served. #3 and #4 are booked; #4 gets marked urgent.
    const session = await makeSession({ currentServing: 2 });
    await makeAppt(session, 1, 'skipped');
    await makeAppt(session, 2, 'called');
    const p3 = await makeAppt(session, 3);
    const p4 = await makeAppt(session, 4);

    await queueService.forceInsert({ appointment: p4, session });

    const result = await queueService.callNext({ session });

    assert.equal(String(result.appointment._id), String(p4._id), 'the urgent patient should be called next, not the older skipped one');
    assert.equal(result.appointment.status, 'called');

    const a3 = await Appointment.findById(p3._id).lean();
    assert.equal(a3.status, 'booked', 'the non-urgent booked patient should be untouched');
  });

  it('falls back to oldest skipped when no one is force-inserted', async () => {
    const session = await makeSession({ currentServing: 2 });
    await makeAppt(session, 1, 'skipped');
    await makeAppt(session, 2, 'called');
    await makeAppt(session, 3);

    const result = await queueService.callNext({ session });

    assert.equal(result.appointment.queueNumber, 1, 'skipped patient should still win when nobody is marked urgent');
  });
});
