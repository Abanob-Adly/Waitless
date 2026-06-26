const accountPolicies = {
  'account.view': (actor, target) => {
    if (actor.isPlatformAdmin) return true;
    return target && actor.account._id.equals(target._id);
  },

  'account.update': (actor, target) => {
    return target && actor.account._id.equals(target._id);
  },
};

// SAAS
const organizationPolicies = {
  'organization.create': (actor) =>
    actor.account.role === 'staff' && actor.account.status === 'active' && actor.account.isEmailVerified,

  'organization.view': (actor, org) => {
    if (!org) return false;
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

  'organization.delete': (actor, org) => {
    if (!org || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(org._id)) return false;
    const m = actor.activeMembership;
    return m.kind === 'admin' && m.isSuper;
  },

  'organization.toggle_public': (actor, org) => {
    if (!org || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(org._id)) return false;
    return actor.activeMembership.kind === 'admin' && actor.activeMembership.isSuper;
  },

};

const branchPolicies = {
  'branch.create': (actor) => {
    const m = actor.activeMembership;
    if (!m || m.status !== 'active') return false;
    if (actor.isPlatformAdmin) return true;
    return m.kind === 'admin' && (m.isSuper || (m.permissions || []).includes('branch.manage'));
  },

  'branch.view': (actor, branch) => {
    if (!branch) return false;
    if (actor.isPlatformAdmin) return true;

    const orgId = branch.organization?._id || branch.organization;
    const org = branch.organization && branch.organization._id ? branch.organization : null;

    if (actor.activeOrgId && orgId && actor.activeOrgId.equals(orgId)) return true;
    return org?.isPublic === true;
  },

  'branch.update': (actor, branch) => {
    if (!branch || !actor.activeMembership) return false;
    if (actor.isPlatformAdmin) return true;

    const orgId = branch.organization?._id || branch.organization;
    if (!actor.activeOrgId?.equals(orgId)) return false;

    const m = actor.activeMembership;
    return (
      m.kind === 'admin' &&
      m.status === 'active' &&
      (m.isSuper || (m.permissions || []).includes('branch.manage'))
    );
  },

  'branch.delete': (actor, branch) => {
    if (!branch || !actor.activeMembership) return false;
    if (actor.isPlatformAdmin) return true;

    const orgId = branch.organization?._id || branch.organization;
    if (!actor.activeOrgId?.equals(orgId)) return false;

    const m = actor.activeMembership;
    return (
      m.kind === 'admin' &&
      m.status === 'active' &&
      (m.isSuper || (m.permissions || []).includes('branch.manage'))
    );
  },
};

const membershipPolicies = {
  'member.invite': (actor, { invitedKind } = {}) => {
    const m = actor.activeMembership;
    if (!m || m.kind !== 'admin') return false;

    // Inviting an admin requires super
    if (invitedKind === 'admin') return m.isSuper;

    // Inviting doctor/receptionist: super OR explicit permission
    return m.isSuper || (m.permissions || []).includes('members.invite');
  },

  'member.revoke': (actor, target) => {
    if (!target || !actor.activeMembership) return false;
    if (!actor.activeOrgId?.equals(target.organization)) return false;
    if (actor.account._id.equals(target.account)) return false; // no self-revoke
    if (target.kind === 'admin' && target.isSuper && !actor.activeMembership.isSuper) {
      return false; // only super can revoke a super
    }
    const m = actor.activeMembership;
    return m.kind === 'admin' && (m.isSuper || (m.permissions || []).includes('members.manage'));
  },
};


export const policies = {
  ...accountPolicies,
  ...organizationPolicies,
  ...membershipPolicies,
  ...branchPolicies,
};