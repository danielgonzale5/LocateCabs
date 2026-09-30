'use strict';

const DEVICE_ID = /^[A-Za-z0-9_-]{1,32}$/;
const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_PASS', 'APP_USER', 'APP_PASSWORD_HASH'];

// Reads configuration from the environment. Values are never logged: errors name
// the variable, not its content.
function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (!/^scrypt:\d+:\d+:\d+:[\w-]+:[\w-]+$/.test(env.APP_PASSWORD_HASH)) {
    throw new Error('APP_PASSWORD_HASH is not a scrypt hash: generate it with `npm run hash-password`');
  }
  return {
    httpPort: toPort(env.HTTP_PORT, 3000, 'HTTP_PORT'),
    udpPort: toPort(env.UDP_PORT, 3020, 'UDP_PORT'),
    trustProxy: env.TRUST_PROXY === '1',
    db: {
      host: env.DB_HOST,
      port: toPort(env.DB_PORT, 3306, 'DB_PORT'),
      user: env.DB_USER,
      password: env.DB_PASS,
      database: env.DB_NAME || 'locatecabs',
    },
    auth: {
      user: env.APP_USER,
      passwordHash: env.APP_PASSWORD_HASH,
    },
    deviceKeys: parseDeviceKeys(env.DEVICE_KEYS || ''),
    webhook: {
      secret: env.GITHUB_WEBHOOK_SECRET || '',
      deployDir: env.DEPLOY_DIR || '',
      branch: env.DEPLOY_BRANCH || 'master',
    },
  };
}

function toPort(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a port number`);
  }
  return port;
}

// DEVICE_KEYS=taxi1:<64 hex chars>,taxi2:<64 hex chars>
function parseDeviceKeys(value) {
  const keys = new Map();
  for (const entry of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [id, hex] = entry.split(':');
    if (!DEVICE_ID.test(id || '')) {
      throw new Error('DEVICE_KEYS has an invalid device id');
    }
    if (!/^[0-9a-f]{64}$/i.test(hex || '')) {
      throw new Error(`DEVICE_KEYS: the key for ${id} must be 32 bytes in hex`);
    }
    keys.set(id, Buffer.from(hex, 'hex'));
  }
  return keys;
}

module.exports = { loadConfig, parseDeviceKeys, DEVICE_ID };
