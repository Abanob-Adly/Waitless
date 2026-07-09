/**
 * Integration tests: per-visit doctor notes (Feature 4).
 * Covers the service layer (create/update/history) and the access-control
 * policies gating who can view or write a note.
 *
 * Run: node --env-file=.env.test --test src/__tests__/integration/sessionNotes.test.js
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { sessionNoteService } from '../../services/sessionNoteService.js';
import { can } from '../../policies/can.js';
import { DoctorMembership, AdminMembership, ReceptionistMembership } from '../../models/Membership.js';
import PatientProfile from '../../models/PatientProfile.js';
import Appointment from '../../models/Appointment.js';
import Branch from '../../models/Branch.js';

const oid = () => new mongoose.Types.ObjectId();

before(connect);
after(disconnect);
beforeEach(clearAll);

async function makeFixtures() {
  const organization = oid();
  const otherOrg = oid();
  const branch = await Branch.create({ organization, name: 'Test Branch' });

  const doctor = await DoctorMembership.create({ organization, account: oid(), status: 'active' });
  const otherDoctor = await DoctorMembership.create({ organization, account: oid(), status: 'active' });
  const admin = await AdminMembership.create({ organization, account: oid(), status: 'active' });
  const outsideAdmin = await AdminMembership.create({ organization: otherOrg, account: oid(), status: 'active' });
  const receptionist = await ReceptionistMembership.create({
    organization, account: oid(), status: 'active', branches: [branch._id],
  });

  const patientProfile = await PatientProfile.create({
    fullName: 'Test Patient', phone: '+201012345678', organizationId: organization,
  });

  const appointment = await Appointment.create({
    session:          oid(),
    patientProfile:   patientProfile._id,
    organization,
    branch:           branch._id,
    doctorMembership: doctor._id,
    queueNumber:      1,
    status:           'completed',
    source:           'walk_in',
  });

  return { organization, otherOrg, doctor, otherDoctor, admin, outsideAdmin, receptionist, patientProfile, appointment };
}

function makeActor(membership) {
  return { activeMembership: membership, activeOrgId: membership.organization };
}

describe('sessionNoteService — create, update, history', () => {
  it('creates a note on first upsert', async () => {
    const { doctor, appointment } = await makeFixtures();
    const note = await sessionNoteService.upsertForAppointment({
      appointment,
      actorMembershipId: doctor._id,
      data: { chiefComplaint: 'Headache', diagnosis: 'Tension headache' },
    });
    assert.equal(note.chiefComplaint, 'Headache');
    assert.equal(note.diagnosis, 'Tension headache');
    assert.equal(note.isSharedWithPatient, false);
    assert.equal(note.editHistory.length, 0);
  });

  it('updating an existing note snapshots the previous content into editHistory', async () => {
    const { doctor, appointment } = await makeFixtures();
    await sessionNoteService.upsertForAppointment({
      appointment, actorMembershipId: doctor._id,
      data: { diagnosis: 'Initial diagnosis' },
    });

    const updated = await sessionNoteService.upsertForAppointment({
      appointment, actorMembershipId: doctor._id,
      data: { diagnosis: 'Revised diagnosis' },
    });

    assert.equal(updated.diagnosis, 'Revised diagnosis');
    assert.equal(updated.editHistory.length, 1);
    assert.equal(updated.editHistory[0].snapshot.diagnosis, 'Initial diagnosis');
    assert.equal(String(updated.editHistory[0].editedBy), String(doctor._id));
  });

  it('getForAppointment returns null when no note exists yet', async () => {
    const { appointment } = await makeFixtures();
    const note = await sessionNoteService.getForAppointment({ appointment });
    assert.equal(note, null);
  });

  it('getForPatient as admin returns notes from every doctor', async () => {
    const { doctor, otherDoctor, admin, patientProfile, appointment } = await makeFixtures();
    await sessionNoteService.upsertForAppointment({
      appointment, actorMembershipId: doctor._id, data: { generalNotes: 'From treating doctor' },
    });

    const otherAppt = await Appointment.create({
      session: oid(), patientProfile: patientProfile._id, organization: doctor.organization,
      branch: appointment.branch, doctorMembership: otherDoctor._id, queueNumber: 2,
      status: 'completed', source: 'walk_in',
    });
    await sessionNoteService.upsertForAppointment({
      appointment: otherAppt, actorMembershipId: otherDoctor._id, data: { generalNotes: 'From other doctor' },
    });

    const notes = await sessionNoteService.getForPatient({ patientProfileId: patientProfile._id, actorMembership: admin });
    assert.equal(notes.length, 2);
  });

  it('getForPatient as a non-admin doctor only returns their own notes', async () => {
    const { doctor, otherDoctor, patientProfile, appointment } = await makeFixtures();
    await sessionNoteService.upsertForAppointment({
      appointment, actorMembershipId: doctor._id, data: { generalNotes: 'From treating doctor' },
    });

    const otherAppt = await Appointment.create({
      session: oid(), patientProfile: patientProfile._id, organization: doctor.organization,
      branch: appointment.branch, doctorMembership: otherDoctor._id, queueNumber: 2,
      status: 'completed', source: 'walk_in',
    });
    await sessionNoteService.upsertForAppointment({
      appointment: otherAppt, actorMembershipId: otherDoctor._id, data: { generalNotes: 'From other doctor' },
    });

    const notes = await sessionNoteService.getForPatient({ patientProfileId: patientProfile._id, actorMembership: doctor });
    assert.equal(notes.length, 1);
    assert.equal(notes[0].generalNotes, 'From treating doctor');
  });
});

describe('sessionNote policies — access control', () => {
  it('sessionNote.view: the treating doctor can view', async () => {
    const { doctor, appointment } = await makeFixtures();
    assert.equal(can(makeActor(doctor), 'sessionNote.view', appointment), true);
  });

  it('sessionNote.view: a different doctor in the same org cannot view', async () => {
    const { otherDoctor, appointment } = await makeFixtures();
    assert.equal(can(makeActor(otherDoctor), 'sessionNote.view', appointment), false);
  });

  it('sessionNote.view: an org admin can view (oversight)', async () => {
    const { admin, appointment } = await makeFixtures();
    assert.equal(can(makeActor(admin), 'sessionNote.view', appointment), true);
  });

  it('sessionNote.view: an admin from a different org cannot view', async () => {
    const { outsideAdmin, appointment } = await makeFixtures();
    assert.equal(can(makeActor(outsideAdmin), 'sessionNote.view', appointment), false);
  });

  it('sessionNote.view: a receptionist cannot view clinical notes', async () => {
    const { receptionist, appointment } = await makeFixtures();
    assert.equal(can(makeActor(receptionist), 'sessionNote.view', appointment), false);
  });

  it('sessionNote.manage: the treating doctor can write', async () => {
    const { doctor, appointment } = await makeFixtures();
    assert.equal(can(makeActor(doctor), 'sessionNote.manage', appointment), true);
  });

  it('sessionNote.manage: an admin can view but not write (does not edit another doctor\'s documentation)', async () => {
    const { admin, appointment } = await makeFixtures();
    assert.equal(can(makeActor(admin), 'sessionNote.manage', appointment), false);
  });

  it('sessionNote.viewPatientHistory: doctor and admin in-org are allowed, receptionist is not', async () => {
    const { doctor, admin, receptionist, patientProfile } = await makeFixtures();
    const profile = { organizationId: patientProfile.organizationId };
    assert.equal(can(makeActor(doctor), 'sessionNote.viewPatientHistory', profile), true);
    assert.equal(can(makeActor(admin), 'sessionNote.viewPatientHistory', profile), true);
    assert.equal(can(makeActor(receptionist), 'sessionNote.viewPatientHistory', profile), false);
  });
});
