const accountPolicies = {
  'account.view': (actor, target) => {
    if (actor.isPlatformAdmin) return true;
    return target && actor.account._id.equals(target._id);
  },

  'account.update': (actor, target) => {
    return target && actor.account._id.equals(target._id);
  },
};

const organizationPolicies = {
  'organization.create': (actor) =>
    actor.account.role === 'staff' && actor.account.status === 'active',

  'organization.view': (actor, org) => {
    if (!org) return false;
    if (!actor) return org.isPublic === true;
    if (actor.isPlatformAdmin) return true;
    if (actor.activeOrgId?.equals(org._id)) return true;
    return org.isPublic === true;
  },

  'organization.update': (actor, org) => {
    if (!org || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(org._id)) return false;
    const m = actor.activeMembership;
    if (m.kind !== 'admin') return false;
    return m.isSuper || (m.permissions || []).includes('organization.update');
  },

  // Any active admin of the org can view or manage the subscription / billing.
  'subscription.manage': (actor, org) => {
    if (!org || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(org._id)) return false;
    return actor.activeMembership.kind === 'admin';
  },

  'organization.toggle_public': (actor, org) => {
    if (!org || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(org._id)) return false;
    return actor.activeMembership.kind === 'admin' && actor.activeMembership.isSuper;
  },

  'organization.manage': (actor, org) => {
    if (!org || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(org._id)) return false;
    const m = actor.activeMembership;
    if (m.kind !== 'admin') return false;
    return m.isSuper || (m.permissions || []).includes('organization.manage');
  },
};

const membershipPolicies = {
  'member.invite': (actor, { invitedKind } = {}) => {
    const m = actor.activeMembership;
    if (!m || m.kind !== 'admin') return false;
    if (invitedKind === 'admin') return m.isSuper;
    return m.isSuper || (m.permissions || []).includes('members.invite');
  },

  'member.list': (actor) => {
    return !!actor.activeMembership;
  },

  'member.view': (actor, membership) => {
    if (!actor.activeMembership) return false;
    if (!membership) return false;
    return actor.activeOrgId?.equals(membership.organization);
  },

  'member.update': (actor, membership) => {
    if (!membership || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(membership.organization)) return false;
    // Allow a member to update any of their own memberships (account-level self-edit).
    // Checking account rather than activeMembership._id handles multi-role users where
    // activeMembership may be a different role than the one being edited.
    if (actor.account._id.equals(membership.account)) return true;
    const m = actor.activeMembership;
    if (!m.isSuper && membership.kind === 'admin') return false;
    return m.kind === 'admin' && (m.isSuper || (m.permissions || []).includes('members.manage'));
  },

  'member.revoke': (actor, target) => {
    if (!target || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(target.organization)) return false;
    // Pending members have account=null; skip the self-revoke guard for them.
    if (target.account && actor.account._id.equals(target.account)) return false;
    if (target.kind === 'admin' && target.isSuper && !actor.activeMembership.isSuper) return false;
    const m = actor.activeMembership;
    return m.kind === 'admin' && (m.isSuper || (m.permissions || []).includes('members.manage'));
  },
};

const branchPolicies = {
  'branch.create': (actor) => {
    const m = actor?.activeMembership;
    return m?.kind === 'admin' && (m.isSuper || (m.permissions || []).includes('branches.manage'));
  },

  // resource is the org document (loaded from the route)
  'branch.list': (actor, org) => {
    if (actor?.activeMembership) return true;
    return org?.isPublic === true;
  },

  'branch.view': (actor, branch) => {
    if (actor?.activeMembership) return true;
    return branch?.organization != null; // allow on public orgs; further restriction done in service
  },

  'branch.update': (actor, branch) => {
    if (!branch || !actor?.activeMembership) return false;
    if (!actor.activeOrgId?.equals(branch.organization)) return false;
    const m = actor.activeMembership;
    return m.kind === 'admin' && (m.isSuper || (m.permissions || []).includes('branches.manage'));
  },

  'branch.delete': (actor, branch) => {
    if (!branch || !actor?.activeMembership) return false;
    if (!actor.activeOrgId?.equals(branch.organization)) return false;
    return actor.activeMembership.kind === 'admin' && actor.activeMembership.isSuper;
  },
};

const schedulePolicies = {
  'schedule.manage': (actor, schedule) => {
    const m = actor.activeMembership;
    if (!m) return false;
    if (m.kind === 'admin') return true;
    if (m.kind === 'doctor' && schedule) return schedule.doctorMembership?.equals(m._id);
    return false;
  },

  'schedule.view': (actor) => {
    return !!actor.activeMembership;
  },
};

const sessionPolicies = {
  'session.generate': (actor) => {
    const m = actor.activeMembership;
    return m?.kind === 'admin' || m?.kind === 'receptionist';
  },

  'session.view': (actor) => {
    return !!actor.activeMembership;
  },

  'session.operate': (actor, session) => {
    const m = actor.activeMembership;
    if (!m) return false;
    if (m.kind === 'admin') return true;
    if (m.kind === 'receptionist') {
      return (m.branches || []).some(b => b.equals(session?.branch));
    }
    if (m.kind === 'doctor') return m._id.equals(session?.doctor);
    return false;
  },
};

const appointmentPolicies = {
  'appointment.book_walkin': (actor) => {
    const m = actor.activeMembership;
    // Doctors have a walk-in form built into their own dashboard (for
    // smaller clinics without dedicated reception staff) — must be allowed
    // here too, not just receptionist/admin.
    return m?.kind === 'receptionist' || m?.kind === 'admin' || m?.kind === 'doctor';
  },

  'appointment.list': (actor) => {
    return !!actor.activeMembership;
  },

  'appointment.view': (actor, appointment) => {
    if (!appointment) return false;
    if (actor.activeMembership) return actor.activeOrgId?.equals(appointment.organization);
    return appointment.patientProfile?.accountId?.equals(actor.account._id);
  },

  'appointment.cancel': (actor, appointment) => {
    if (!appointment) return false;
    if (actor.activeMembership) return actor.activeOrgId?.equals(appointment.organization);
    return appointment.patientProfile?.accountId?.equals(actor.account._id);
  },

  'appointment.book_marketplace': (actor) => {
    return actor.account.role === 'patient';
  },

  'appointment.confirm_payment': (actor, appointment) => {
    if (!appointment) return false;
    if (!actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(appointment.organization)) return false;
    const m = actor.activeMembership;
    return m.kind === 'receptionist' || m.kind === 'admin' || m.kind === 'doctor';
  },
};

// True when this account holds the specific doctor membership referenced on
// the resource, in ANY of its active memberships for this org — not just
// whichever one activeMembership resolved to. A dual-role account (admin +
// doctor in the same org, e.g. a clinic owner who also practices) always gets
// activeMembership = admin (see authenticate.js), which would otherwise
// silently block them from writing their own clinical notes.
function isTreatingDoctor(actor, doctorMembershipId) {
  if (!doctorMembershipId) return false;
  return (actor.orgMemberships || []).some(
    (m) => m.kind === 'doctor' && m._id.equals(doctorMembershipId),
  );
}

const sessionNotePolicies = {
  // Clinical documentation is restricted to the doctor who treated this
  // specific patient visit, plus org admins (the confirmed "clinical admin"
  // definition for this pass — no separate clinical-admin role exists yet).
  // Receptionists never see clinical notes, even though they share the org.
  'sessionNote.view': (actor, appointment) => {
    if (!appointment || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(appointment.organization)) return false;
    if (actor.activeMembership.kind === 'admin') return true;
    return isTreatingDoctor(actor, appointment.doctorMembership);
  },

  // Writing (create/update) is narrower than viewing — only the treating
  // doctor authors their own clinical notes; admins can view for oversight
  // but do not edit another doctor's documentation.
  'sessionNote.manage': (actor, appointment) => {
    if (!appointment || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(appointment.organization)) return false;
    return isTreatingDoctor(actor, appointment.doctorMembership);
  },

  // Gate for a patient's full note history — any admin or doctor in the same
  // org may call this endpoint; the service layer then filters individual
  // notes further (a non-admin doctor only sees notes they personally wrote,
  // not a colleague's, since this route isn't scoped to one specific visit).
  'sessionNote.viewPatientHistory': (actor, profile) => {
    if (!profile || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(profile.organizationId)) return false;
    if (actor.activeMembership.kind === 'admin') return true;
    return (actor.orgMemberships || []).some((m) => m.kind === 'doctor');
  },
};

const queuePolicies = {
  'queue.view': (actor) => {
    return !!actor.activeMembership;
  },

  'queue.operate': (actor, session) => {
    const m = actor.activeMembership;
    if (!m) return false;
    if (m.kind === 'admin') return true;
    if (m.kind === 'receptionist') {
      return (m.branches || []).some(b => b.equals(session?.branch));
    }
    if (m.kind === 'doctor') return m._id.equals(session?.doctor);
    return false;
  },
};

const payoutPolicies = {
  'payouts.manage': (actor) => {
    return !!actor?.isPlatformAdmin;
  },
};

const patientPolicies = {
  'patient.create': (actor) => {
    const m = actor.activeMembership;
    return m?.kind === 'admin' || m?.kind === 'receptionist';
  },

  'patient.list': (actor) => {
    return !!actor.activeMembership;
  },

  'patient.view': (actor, profile) => {
    if (!profile) return false;
    if (actor.activeMembership) return actor.activeOrgId?.equals(profile.organizationId);
    return profile.accountId?.equals(actor.account._id);
  },

  'patient.update': (actor, profile) => {
    if (!profile) return false;
    if (actor.activeMembership) return actor.activeOrgId?.equals(profile.organizationId);
    return profile.accountId?.equals(actor.account._id);
  },
};

export const policies = {
  ...accountPolicies,
  ...organizationPolicies,
  ...membershipPolicies,
  ...branchPolicies,
  ...schedulePolicies,
  ...sessionPolicies,
  ...appointmentPolicies,
  ...sessionNotePolicies,
  ...queuePolicies,
  ...payoutPolicies,
  ...patientPolicies,
};
