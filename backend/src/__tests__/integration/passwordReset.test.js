/**
 * Integration test: full forgot-password flow, end to end through the
 * service layer (register -> request reset -> confirm -> login with the
 * new password), plus the failure modes that must be rejected.
 *
 * Run: node --env-file=.env.test --test src/__tests__/integration/passwordReset.test.js
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { authService } from '../../services/auth.js';
import { emailProvider } from '../../services/providers/email.js';
import VerificationToken from '../../models/verificationToken.js';

before(connect);
after(disconnect);
beforeEach(clearAll);

function captureNextEmail() {
  const original = emailProvider.send;
  const captured = {};
  emailProvider.send = async ({ to, body }) => {
    const match = body.match(/token=([^\s]+)/);
    captured.token = match ? decodeURIComponent(match[1]) : null;
    captured.to = to;
    return { id: 'stub' };
  };
  return { captured, restore: () => { emailProvider.send = original; } };
}

describe('forgot password — full end-to-end flow', () => {
  it('register -> request reset -> confirm -> login with new password succeeds, old password fails', async () => {
    await authService.registerWorker({
      email: 'flow@test.com', password: 'OldPassword1', fullName: 'Flow Test',
    });

    const { captured, restore } = captureNextEmail();
    await authService.requestPasswordReset({ email: 'flow@test.com' });
    restore();
    assert.ok(captured.token, 'a reset token must have been emailed');

    await authService.confirmPasswordReset({ token: captured.token, newPassword: 'NewPassword2' });

    // New password works
    const loggedIn = await authService.loginWorker({ identifier: 'flow@test.com', password: 'NewPassword2' });
    assert.ok(loggedIn.account, 'login with the new password must succeed');

    // Old password no longer works
    await assert.rejects(
      () => authService.loginWorker({ identifier: 'flow@test.com', password: 'OldPassword1' }),
      /Invalid credentials/,
    );
  });

  it('a consumed (already-used) token cannot be reused', async () => {
    await authService.registerWorker({ email: 'reuse@test.com', password: 'OldPassword1', fullName: 'Reuse Test' });
    const { captured, restore } = captureNextEmail();
    await authService.requestPasswordReset({ email: 'reuse@test.com' });
    restore();

    await authService.confirmPasswordReset({ token: captured.token, newPassword: 'NewPassword2' });

    await assert.rejects(
      () => authService.confirmPasswordReset({ token: captured.token, newPassword: 'AnotherPassword3' }),
      /Invalid reset token/,
    );
  });

  it('an expired token is rejected', async () => {
    await authService.registerWorker({ email: 'expired@test.com', password: 'OldPassword1', fullName: 'Expired Test' });
    const { captured, restore } = captureNextEmail();
    await authService.requestPasswordReset({ email: 'expired@test.com' });
    restore();

    // Force the stored token into the past instead of waiting out the real TTL.
    await VerificationToken.updateOne(
      { purpose: 'password_reset' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    await assert.rejects(
      () => authService.confirmPasswordReset({ token: captured.token, newPassword: 'NewPassword2' }),
      /Code expired/,
    );
  });

  it('requesting a reset for an unknown email returns ok without sending anything (no enumeration)', async () => {
    const { captured, restore } = captureNextEmail();
    const result = await authService.requestPasswordReset({ email: 'nobody@test.com' });
    restore();

    assert.deepEqual(result, { ok: true });
    assert.equal(captured.token, undefined, 'no email should be sent for a non-existent account');
  });

  it('an email-provider failure does not throw — request still resolves ok (does not leak or crash)', async () => {
    await authService.registerWorker({ email: 'provider-fail@test.com', password: 'OldPassword1', fullName: 'Provider Fail' });

    const original = emailProvider.send;
    emailProvider.send = async () => { throw new Error('sandbox sender restriction'); };
    let result;
    try {
      result = await authService.requestPasswordReset({ email: 'provider-fail@test.com' });
    } finally {
      emailProvider.send = original;
    }

    assert.deepEqual(result, { ok: true }, 'must still report success even when the provider throws');
  });
});
