'use strict';

// LC-02 (unauthenticated UDP), LC-04 (crash on bad input), LC-07 (markup in the taxi id)
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createDatagramVerifier, encodeDatagram } = require('../src/datagram');

const NOW = 1_790_000_000_000;
const key = crypto.randomBytes(32);
const otherKey = crypto.randomBytes(32);
const keys = new Map([['taxi1', key]]);
const fix = { id: 'taxi1', lat: '10.98472', lon: '-74.81130', ts: NOW };

const verifier = () => createDatagramVerifier({ keys, now: () => NOW });

test('accepts a datagram signed with the device key', () => {
  const result = verifier()(encodeDatagram(key, fix));
  assert.deepEqual(result, { ok: true, position: { id: 'taxi1', lat: 10.98472, lon: -74.8113, ts: NOW } });
});

test('rejects the 2021 format, which had no signature', () => {
  const result = verifier()(Buffer.from(`taxi1;10.98472;-74.81130;${NOW}`));
  assert.equal(result.ok, false);
});

test('rejects a datagram signed with another key', () => {
  assert.deepEqual(verifier()(encodeDatagram(otherKey, fix)), { ok: false, reason: 'bad signature' });
});

test('rejects a datagram whose position was changed after signing', () => {
  const tampered = encodeDatagram(key, fix).toString().replace('10.98472', '10.99999');
  assert.deepEqual(verifier()(Buffer.from(tampered)), { ok: false, reason: 'bad signature' });
});

test('rejects a device that has no key', () => {
  const result = verifier()(encodeDatagram(key, { ...fix, id: 'taxi9' }));
  assert.deepEqual(result, { ok: false, reason: 'unknown device' });
});

test('rejects markup or an overlong value in the device id before anything else', () => {
  const verify = createDatagramVerifier({ keys: new Map([['<b>x</b>', key]]), now: () => NOW });
  assert.deepEqual(verify(encodeDatagram(key, { ...fix, id: '<b>x</b>' })), { ok: false, reason: 'invalid device id' });
  assert.deepEqual(verifier()(encodeDatagram(key, { ...fix, id: 'x'.repeat(80) })), { ok: false, reason: 'invalid device id' });
});

test('rejects a replayed datagram', () => {
  const verify = verifier();
  const datagram = encodeDatagram(key, fix);
  assert.equal(verify(datagram).ok, true);
  assert.deepEqual(verify(datagram), { ok: false, reason: 'replayed or out of order' });
});

test('replay protection survives a restart when seeded from the database', () => {
  const verify = createDatagramVerifier({ keys, now: () => NOW, lastSeen: new Map([['taxi1', NOW]]) });
  assert.deepEqual(verify(encodeDatagram(key, fix)), { ok: false, reason: 'replayed or out of order' });
});

test('rejects timestamps outside the one-minute window', () => {
  const verify = verifier();
  assert.equal(verify(encodeDatagram(key, { ...fix, ts: NOW - 61_000 })).reason, 'timestamp outside the allowed window');
  assert.equal(verify(encodeDatagram(key, { ...fix, ts: NOW + 61_000 })).reason, 'timestamp outside the allowed window');
});

test('rejects coordinates that are not numbers or out of range', () => {
  assert.equal(verifier()(encodeDatagram(key, { ...fix, lat: '91.0' })).reason, 'coordinates out of range');
  assert.equal(verifier()(encodeDatagram(key, { ...fix, lon: '1e3' })).reason, 'invalid coordinates');
});

test('rejects malformed and oversized datagrams without throwing', () => {
  assert.equal(verifier()(Buffer.from('')).reason, 'malformed');
  assert.equal(verifier()(Buffer.from('a;b;c;d;e;f')).reason, 'malformed');
  assert.equal(verifier()(Buffer.alloc(300, 'a')).reason, 'too long');
  assert.equal(verifier()(Buffer.from(`taxi1;1;1;${NOW};nothex`)).reason, 'malformed signature');
});
