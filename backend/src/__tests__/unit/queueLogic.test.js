/**
 * Pure-logic unit tests — no database, no Redis, no network.
 * Tests the mathematical invariants of queue capacity and EWT formulas.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── checkDailyCapacity (extracted for isolated testing) ───────────────────────

function checkDailyCapacity(session) {
  const shiftMin    = (new Date(session.endTime) - new Date(session.startTime)) / 60_000;
  const maxPatients = Math.floor(shiftMin / session.avgConsultationMin);
  return {
    maxPatients,
    currentBookings: session.bookingsCount,
    remainingSlots:  Math.max(0, maxPatients - session.bookingsCount),
    isFull:          session.bookingsCount >= maxPatients,
  };
}

// ── APPT_DURATIONS (mirrors queueService constant) ────────────────────────────

const APPT_DURATIONS_MIN = { follow_up: 5, medical_rep: 5 };

function apptDuration(appt, avgMin) {
  return APPT_DURATIONS_MIN[appt.appointmentType] ?? avgMin;
}

function makeSession(opts = {}) {
  const start = opts.startTime ?? '2026-01-01T08:00:00Z';
  const end   = opts.endTime   ?? '2026-01-01T09:00:00Z'; // 60-min default
  return {
    startTime:          start,
    endTime:            end,
    avgConsultationMin: opts.avgConsultationMin ?? 15,
    bookingsCount:      opts.bookingsCount      ?? 0,
  };
}

// ── checkDailyCapacity ────────────────────────────────────────────────────────

describe('checkDailyCapacity', () => {
  it('1-hour shift at 15 min/appt → 4 max patients', () => {
    const result = checkDailyCapacity(makeSession({ avgConsultationMin: 15 }));
    assert.equal(result.maxPatients, 4);
  });

  it('2-hour shift at 15 min/appt → 8 max patients', () => {
    const result = checkDailyCapacity(makeSession({
      endTime: '2026-01-01T10:00:00Z',
      avgConsultationMin: 15,
    }));
    assert.equal(result.maxPatients, 8);
  });

  it('remainingSlots is maxPatients minus currentBookings', () => {
    const result = checkDailyCapacity(makeSession({
      avgConsultationMin: 15,
      bookingsCount: 2,
    }));
    assert.equal(result.remainingSlots, 2);
    assert.equal(result.isFull, false);
  });

  it('isFull is true when bookingsCount >= maxPatients', () => {
    const result = checkDailyCapacity(makeSession({
      avgConsultationMin: 15,
      bookingsCount: 4,
    }));
    assert.equal(result.isFull, true);
    assert.equal(result.remainingSlots, 0);
  });

  it('remainingSlots never goes negative when overbooked', () => {
    const result = checkDailyCapacity(makeSession({
      avgConsultationMin: 15,
      bookingsCount: 10, // more than maxPatients=4
    }));
    assert.equal(result.remainingSlots, 0);
    assert.equal(result.isFull, true);
  });

  it('partial slot at end is floored (45-min shift at 20 min/appt → 2 max, not 2.25)', () => {
    const result = checkDailyCapacity(makeSession({
      endTime: '2026-01-01T08:45:00Z', // 45-min shift
      avgConsultationMin: 20,
    }));
    assert.equal(result.maxPatients, 2); // floor(45/20) = 2
  });
});

// ── apptDuration ──────────────────────────────────────────────────────────────

describe('apptDuration', () => {
  it('follow_up returns 5 regardless of avgMin', () => {
    assert.equal(apptDuration({ appointmentType: 'follow_up' }, 15), 5);
    assert.equal(apptDuration({ appointmentType: 'follow_up' }, 30), 5);
  });

  it('medical_rep returns 5 regardless of avgMin', () => {
    assert.equal(apptDuration({ appointmentType: 'medical_rep' }, 15), 5);
  });

  it('new_consultation falls back to avgMin', () => {
    assert.equal(apptDuration({ appointmentType: 'new_consultation' }, 15), 15);
    assert.equal(apptDuration({ appointmentType: 'new_consultation' }, 20), 20);
  });

  it('undefined appointmentType falls back to avgMin', () => {
    assert.equal(apptDuration({}, 12), 12);
  });
});

// ── EWT formula (positional) ──────────────────────────────────────────────────

describe('EWT positional formula', () => {
  // Mirrors the walk-in EWT calc in appointmentService.bookWalkIn
  function calcPositionalEWT(queueNumber, currentServing, avgMin, globalDelayMin) {
    const position = Math.max(0, queueNumber - currentServing);
    return position * avgMin + globalDelayMin;
  }

  it('patient at position 1 ahead waits avgMin + globalDelay', () => {
    // queueNumber=3, currentServing=2 → 1 patient ahead
    const wait = calcPositionalEWT(3, 2, 15, 0);
    assert.equal(wait, 15);
  });

  it('global delay is always added on top', () => {
    const wait = calcPositionalEWT(3, 2, 15, 10);
    assert.equal(wait, 25); // 1×15 + 10
  });

  it('no wait when patient is next in queue', () => {
    // queueNumber equals next serving
    const wait = calcPositionalEWT(3, 3, 15, 0);
    assert.equal(wait, 0);
  });

  it('negative position is clamped to 0', () => {
    // currentServing already passed patient (shouldn't happen, but guard holds)
    const wait = calcPositionalEWT(2, 5, 15, 0);
    assert.equal(wait, 0);
  });
});

// ── Late-start detection formula ──────────────────────────────────────────────

describe('late-start delay accumulation', () => {
  function calcLateMin(startTimeISO, nowISO) {
    const scheduledStart = new Date(startTimeISO);
    const now            = new Date(nowISO);
    if (now <= scheduledStart) return 0;
    return Math.round((now.getTime() - scheduledStart.getTime()) / 60_000);
  }

  it('on-time start adds 0 delay', () => {
    assert.equal(calcLateMin('2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z'), 0);
  });

  it('30-second early start adds 0 delay', () => {
    assert.equal(calcLateMin('2026-01-01T09:00:00Z', '2026-01-01T08:59:30Z'), 0);
  });

  it('15 min late start adds 15 min', () => {
    assert.equal(calcLateMin('2026-01-01T09:00:00Z', '2026-01-01T09:15:00Z'), 15);
  });

  it('sub-minute rounding: 30s late rounds to 1 min', () => {
    assert.equal(calcLateMin('2026-01-01T09:00:00Z', '2026-01-01T09:00:30Z'), 1);
  });

  it('44s late rounds to 1 min', () => {
    assert.equal(calcLateMin('2026-01-01T09:00:00Z', '2026-01-01T09:00:44Z'), 1);
  });
});
