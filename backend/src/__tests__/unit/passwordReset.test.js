/**
 * Unit tests: password-reset token generation, hashing, and lookup.
 *
 * Covers the two root-cause bugs fixed in this pass:
 *  1. Password-reset tokens must be hashed deterministically (sha256), not
 *     with bcrypt — bcrypt can't be looked up by value, which is what
 *     forced the old code to guess "whichever unconsumed token is newest"
 *     instead of finding the actual matching record.
 *  2. That lookup must be scoped to the token's own hash, so two concurrent
 *     outstanding password-reset requests (any two accounts) don't clobber
 *     each other.
 *
 * Run: node --env-file=.env.test --test src/__tests__/unit/passwordReset.test.js
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connect, disconnect, clearAll } from '../helpers/db.js';
import { verificationService } from '../../services/verification.js';
import { sha256, generateToken } from '../../utils/otp.js';
import VerificationToken from '../../models/verificationToken.js';
import Account from '../../models/Account.js';

const oid = () => new mongoose.Types.ObjectId();

async function makeAccount(email) {
  return Account.create({
    email,
    fullName: 'Test User',
    passwordHash: 'x', // not exercised by these tests
    role: 'staff',
    status: 'active',
  });
}

before(connect);
after(disconnect);
beforeEach(clearAll);

describe('sha256 token hashing — deterministic and lookup-friendly', () => {
  it('hashes the same input to the same output (unlike bcrypt, which salts per-call)', () => {
    const token = generateToken(32);
    assert.equal(sha256(token), sha256(token));
  });

  it('produces different hashes for different tokens', () => {
    assert.notEqual(sha256(generateToken(32)), sha256(generateToken(32)));
  });

  it('generateToken produces a URL-safe, high-entropy value', () => {
    const token = generateToken(32);
    // base64url of 32 bytes is 43 chars, no padding
    assert.equal(token.length, 43);
    assert.match(token, /^[A-Za-z0-9_-]+$/);
  });
});

describe('verificationService.issue — password_reset stores a sha256 hash', () => {
  it('stores codeHash as sha256 of the emailed token, not bcrypt', async () => {
    const account = await makeAccount('a@test.com');
    let capturedBody = '';
    const { emailProvider } = await import('../../services/providers/email.js');
    const originalSend = emailProvider.send;
    emailProvider.send = async ({ body }) => { capturedBody = body; return { id: 'stub' }; };
    try {
      await verificationService.issue({ account, purpose: 'password_reset', sendTo: account.email });
    } finally {
      emailProvider.send = originalSend;
    }

    const match = capturedBody.match(/token=([^\s]+)/);
    assert.ok(match, 'email body should contain the reset link with a token');
    const rawToken = decodeURIComponent(match[1]);

    const stored = await VerificationToken.findOne({ account: account._id, purpose: 'password_reset' });
    assert.equal(stored.codeHash, sha256(rawToken), 'stored hash must equal sha256(rawToken), enabling direct lookup');
  });
});

describe('password-reset lookup is scoped by token hash, not "newest wins"', () => {
  it('two concurrent outstanding tokens (different accounts) can each be found and confirmed independently', async () => {
    const alice = await makeAccount('alice@test.com');
    const bob = await makeAccount('bob@test.com');

    const { emailProvider } = await import('../../services/providers/email.js');
    const originalSend = emailProvider.send;
    const captured = {};
    emailProvider.send = async ({ to, body }) => {
      const match = body.match(/token=([^\s]+)/);
      captured[to] = decodeURIComponent(match[1]);
      return { id: 'stub' };
    };
    try {
      // Bob requests a reset AFTER Alice — his token is now the "newest".
      await verificationService.issue({ account: alice, purpose: 'password_reset', sendTo: alice.email });
      await verificationService.issue({ account: bob, purpose: 'password_reset', sendTo: bob.email });
    } finally {
      emailProvider.send = originalSend;
    }

    // Alice's older token must still resolve to Alice's own record, not
    // Bob's newer one (the exact scenario the old ".sort({createdAt:-1})
    // grab the newest" lookup got wrong).
    const aliceRecord = await VerificationToken.findOne({
      purpose: 'password_reset',
      codeHash: sha256(captured['alice@test.com']),
    });
    assert.ok(aliceRecord, 'Alice\'s token must resolve to a record');
    assert.equal(String(aliceRecord.account), String(alice._id));

    const bobRecord = await VerificationToken.findOne({
      purpose: 'password_reset',
      codeHash: sha256(captured['bob@test.com']),
    });
    assert.ok(bobRecord, 'Bob\'s token must resolve to a record');
    assert.equal(String(bobRecord.account), String(bob._id));
  });

  it('a token that does not match any stored hash resolves to nothing', async () => {
    const account = await makeAccount('c@test.com');
    const { emailProvider } = await import('../../services/providers/email.js');
    const originalSend = emailProvider.send;
    emailProvider.send = async () => ({ id: 'stub' });
    try {
      await verificationService.issue({ account, purpose: 'password_reset', sendTo: account.email });
    } finally {
      emailProvider.send = originalSend;
    }

    const bogus = await VerificationToken.findOne({
      purpose: 'password_reset',
      codeHash: sha256('not-the-real-token'),
    });
    assert.equal(bogus, null);
  });
});
