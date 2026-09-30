'use strict';

// LC-03: operator login.
const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, parseBasicAuth, createAuthenticator } = require('../src/auth');

const hash = hashPassword('correct horse battery');
const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
const request = (authorization, ip = '192.0.2.10', headers = {}) => ({
  headers: { ...(authorization ? { authorization } : {}), ...headers },
  socket: { remoteAddress: ip },
});

test('stores a salted scrypt hash, never the password', () => {
  assert.match(hash, /^scrypt:16384:8:1:[\w-]+:[\w-]+$/);
  assert.ok(!hash.includes('correct horse battery'));
  assert.notEqual(hashPassword('correct horse battery'), hash);
});

test('verifies the right password only', () => {
  assert.equal(verifyPassword('correct horse battery', hash), true);
  assert.equal(verifyPassword('correct horse batterx', hash), false);
  assert.equal(verifyPassword('anything', 'not-a-hash'), false);
});

test('parses Basic credentials, including a colon in the password', () => {
  assert.deepEqual(parseBasicAuth(basic('operator', 'a:b')), { user: 'operator', password: 'a:b' });
  assert.equal(parseBasicAuth('Bearer x'), null);
  assert.equal(parseBasicAuth(undefined), null);
});

test('accepts the operator and rejects a wrong user, password or no header', () => {
  const auth = createAuthenticator({ user: 'operator', passwordHash: hash });
  assert.equal(auth.check(request(basic('operator', 'correct horse battery'))), 'ok');
  assert.equal(auth.check(request(basic('admin', 'correct horse battery'))), 'denied');
  assert.equal(auth.check(request(basic('operator', 'wrong'))), 'denied');
  assert.equal(auth.check(request(undefined)), 'missing');
});

test('locks out an address after repeated failures, then lets it try again', () => {
  let now = 0;
  const auth = createAuthenticator({ user: 'operator', passwordHash: hash, maxFailures: 3, lockoutMs: 1000, now: () => now });
  for (let i = 0; i < 3; i += 1) assert.equal(auth.check(request(basic('operator', 'wrong'))), 'denied');
  assert.equal(auth.check(request(basic('operator', 'correct horse battery'))), 'locked');
  assert.equal(auth.check(request(basic('operator', 'correct horse battery'), '192.0.2.99')), 'ok');
  now = 1001;
  assert.equal(auth.check(request(basic('operator', 'correct horse battery'))), 'ok');
});

test('behind a proxy, failures count against the client address, not the proxy', () => {
  const auth = createAuthenticator({ user: 'operator', passwordHash: hash, trustProxy: true, maxFailures: 1 });
  const viaProxy = (auth_, client) => request(auth_, '10.0.0.1', { 'x-forwarded-for': client });
  assert.equal(auth.check(viaProxy(basic('operator', 'wrong'), '198.51.100.7')), 'denied');
  assert.equal(auth.check(viaProxy(basic('operator', 'correct horse battery'), '198.51.100.7')), 'locked');
  assert.equal(auth.check(viaProxy(basic('operator', 'correct horse battery'), '198.51.100.8')), 'ok');
});
