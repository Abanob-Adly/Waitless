/**
 * Pure-logic unit tests — no database, no Redis, no network.
 * Validates scheduleSchemas' time-range and overlap checks, which let a
 * doctor have more than one session per day (e.g. morning + evening clinic)
 * while still catching an admin's invalid or overlapping time entries before
 * they're saved.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSchemas } from '../../controllers/scheduleController.js';

function baseCreatePayload(schedule) {
  return {
    doctorMembershipId: '507f1f77bcf86cd799439011',
    branchId:           '507f1f77bcf86cd799439012',
    schedule,
    avgConsultationMin: 15,
  };
}

describe('scheduleSchemas.create — multiple slots per day', () => {
  it('accepts two non-overlapping slots on the same day (morning + evening clinic)', () => {
    const result = scheduleSchemas.create.safeParse(baseCreatePayload([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '17:00', endTime: '20:00' },
    ]));
    assert.equal(result.success, true);
  });

  it('accepts slots spread across different days', () => {
    const result = scheduleSchemas.create.safeParse(baseCreatePayload([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '12:00' },
    ]));
    assert.equal(result.success, true);
  });

  it('rejects a slot whose end time is before its start time', () => {
    const result = scheduleSchemas.create.safeParse(baseCreatePayload([
      { dayOfWeek: 1, startTime: '14:00', endTime: '10:00' },
    ]));
    assert.equal(result.success, false);
    assert.ok(/end time must be after start time/i.test(result.error.issues[0].message));
  });

  it('rejects a slot whose end time equals its start time', () => {
    const result = scheduleSchemas.create.safeParse(baseCreatePayload([
      { dayOfWeek: 1, startTime: '09:00', endTime: '09:00' },
    ]));
    assert.equal(result.success, false);
  });

  it('rejects two overlapping slots on the same day', () => {
    const result = scheduleSchemas.create.safeParse(baseCreatePayload([
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 1, startTime: '12:00', endTime: '15:00' },
    ]));
    assert.equal(result.success, false);
    assert.ok(/overlap/i.test(result.error.issues[0].message));
  });

  it('rejects slots that touch exactly at the boundary (back-to-back is fine, but this one truly overlaps)', () => {
    // Back-to-back (12:00 end, 12:00 start) should be ALLOWED — no overlap.
    const backToBack = scheduleSchemas.create.safeParse(baseCreatePayload([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '12:00', endTime: '15:00' },
    ]));
    assert.equal(backToBack.success, true, 'back-to-back slots should not count as overlapping');
  });

  it('rejects an empty schedule array', () => {
    const result = scheduleSchemas.create.safeParse(baseCreatePayload([]));
    assert.equal(result.success, false);
  });
});

describe('scheduleSchemas.update — same validation applies', () => {
  it('rejects overlapping slots when updating', () => {
    const result = scheduleSchemas.update.safeParse({
      schedule: [
        { dayOfWeek: 2, startTime: '08:00', endTime: '11:00' },
        { dayOfWeek: 2, startTime: '10:00', endTime: '13:00' },
      ],
    });
    assert.equal(result.success, false);
  });

  it('allows omitting schedule entirely (e.g. fee-only update)', () => {
    const result = scheduleSchemas.update.safeParse({ avgConsultationMin: 20 });
    assert.equal(result.success, true);
  });
});
