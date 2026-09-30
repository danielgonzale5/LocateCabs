'use strict';

// LC-08: configuration errors name the variable, never its value.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');
const { hashPassword } = require('../src/auth');

const base = {
  DB_HOST: 'db',
  DB_USER: 'locatecabs',
  DB_PASS: 'db-secret-value',
  APP_USER: 'operator',
  APP_PASSWORD_HASH: hashPassword('correct horse battery'),
  DEVICE_KEYS: `taxi1:${'ab'.repeat(32)}`,
};

test('loads a complete configuration with defaults', () => {
  const config = loadConfig(base);
  assert.equal(config.httpPort, 3000);
  assert.equal(config.udpPort, 3020);
  assert.equal(config.db.database, 'locatecabs');
  assert.equal(config.deviceKeys.get('taxi1').length, 32);
  assert.equal(config.webhook.secret, '');
});

test('names missing variables without printing any value', () => {
  const { DB_PASS, APP_USER, ...rest } = base;
  assert.throws(() => loadConfig(rest), (err) => {
    assert.equal(err.message, 'Missing required environment variables: DB_PASS, APP_USER');
    return true;
  });
});

test('refuses a plain-text password in APP_PASSWORD_HASH', () => {
  assert.throws(() => loadConfig({ ...base, APP_PASSWORD_HASH: 'hunter2' }), (err) => {
    assert.doesNotMatch(err.message, /hunter2/);
    return true;
  });
});

test('refuses short device keys and invalid device ids', () => {
  assert.throws(() => loadConfig({ ...base, DEVICE_KEYS: 'taxi1:abcd' }), /32 bytes/);
  assert.throws(() => loadConfig({ ...base, DEVICE_KEYS: `<b>:${'ab'.repeat(32)}` }), /invalid device id/);
});
