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


// suport funcs
const hasPermission = (membership, permission) => {
  const perms = membership?.permissions || [];
  return membership?.isSuper === true || perms.includes('*') || perms.includes(permission);
};
const sameOrg = (actor, orgId) => actor.activeOrgId && actor.activeOrgId.equals(orgId);

const membershipPolicies = {
  'member.invite': (actor, { invitedKind, organization } = {}) => {
    const m = actor.activeMembership;
    if (!m || m.kind !== 'admin' || m.status !== 'active') return false;
    if (organization && !sameOrg(actor, organization._id || organization)) return false;

    if (invitedKind === 'admin') return m.isSuper;
    return hasPermission(m, 'members.invite');
  },

  'member.view': (actor, target) => {
    if (actor.isPlatformAdmin) return true;
    if (!target) return false;

    const orgId = target.organization?._id || target.organization || target._id;
    return !!actor.activeMembership && sameOrg(actor, orgId) && actor.activeMembership.status === 'active';
  },

  'member.update': (actor, target) => {
    if (!target || !actor.activeMembership) return false;
    if (!sameOrg(actor, target.organization)) return false;
    if (actor.activeMembership.status !== 'active') return false;

    if (actor.activeMembership.kind === 'admin') {
      return hasPermission(actor.activeMembership, 'members.manage');
    }

    return target.kind === 'doctor' && actor.account._id.equals(target.account?._id || target.account);
  },

  'member.suspend': (actor, target) => {
    if (!target || !actor.activeMembership) return false;
    if (!sameOrg(actor, target.organization)) return false;
    if (actor.account._id.equals(target.account?._id || target.account)) return false;
    return actor.activeMembership.kind === 'admin' &&
      actor.activeMembership.status === 'active' &&
      hasPermission(actor.activeMembership, 'members.manage');
  },

  'member.reactivate': (actor, target) => {
    if (!target || !actor.activeMembership) return false;
    if (!sameOrg(actor, target.organization)) return false;
    return actor.activeMembership.kind === 'admin' &&
      actor.activeMembership.status === 'active' &&
      hasPermission(actor.activeMembership, 'members.manage');
  },

  'member.revoke': (actor, target) => {
    if (!target || !actor.activeMembership) return false;
    if (!sameOrg(actor, target.organization)) return false;
    if (actor.account._id.equals(target.account?._id || target.account)) return false;
    if (target.kind === 'admin' && target.isSuper && !actor.activeMembership.isSuper) return false;
    return actor.activeMembership.kind === 'admin' &&
      actor.activeMembership.status === 'active' &&
      hasPermission(actor.activeMembership, 'members.manage');
  },

  'member.cancel_invite': (actor, target) => {
    if (!target || !actor.activeMembership) return false;
    if (!sameOrg(actor, target.organization)) return false;
    if (target.status !== 'pending') return false;
    return (
      actor.account._id.equals(target.invitedBy?._id || target.invitedBy) ||
      (actor.activeMembership.kind === 'admin' && hasPermission(actor.activeMembership, 'members.invite'))
    );
  },

  'member.permissions.update': (actor, target) => {
    if (!target || !actor.activeMembership) return false;
    if (!sameOrg(actor, target.organization)) return false;
    return actor.activeMembership.kind === 'admin' && actor.activeMembership.isSuper;
  },
};


export const policies = {
  ...accountPolicies,
  ...organizationPolicies,
  ...branchPolicies,
  ...membershipPolicies,
};