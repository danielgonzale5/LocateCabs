'use strict';

const crypto = require('crypto');

// Stored format: scrypt:N:r:p:<salt base64url>:<hash base64url>
// (no '$', so the value survives .env files and docker compose interpolation).
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function hashPassword(password, salt = crypto.randomBytes(16)) {
  const { N, r, p, keylen } = SCRYPT;
  const hash = crypto.scryptSync(password, salt, keylen, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join(':');
}

function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, hash] = String(stored).split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return crypto.timingSafeEqual(actual, expected);
}

function parseBasicAuth(header) {
  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(header || '');
  if (!match) return null;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon < 0) return null;
  return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

// With TRUST_PROXY=1 the app sits behind exactly one reverse proxy, which appends
// the real client address as the last X-Forwarded-For entry.
function clientIp(req, trustProxy) {
  const forwarded = req.headers['x-forwarded-for'];
  if (trustProxy && forwarded) return forwarded.split(',').pop().trim();
  return req.socket.remoteAddress;
}

// HTTP Basic authentication for the single operator account, checked on every
// HTTP request and on the Socket.IO handshake. scrypt is slow on purpose, so a
// verified header is cached for a few minutes, and an address that keeps
// failing is locked out for a while.
function createAuthenticator({
  user,
  passwordHash,
  trustProxy = false,
  maxFailures = 10,
  lockoutMs = 15 * 60_000,
  cacheMs = 5 * 60_000,
  now = Date.now,
}) {
  const expectedUser = sha256(user);
  const verified = new Map(); // sha256(header) -> expiry
  const failures = new Map(); // ip -> { count, since }

  function check(req) {
    const ip = clientIp(req, trustProxy);
    const record = failures.get(ip);
    if (record && now() - record.since > lockoutMs) failures.delete(ip);
    else if (record && record.count >= maxFailures) return 'locked';

    const header = req.headers.authorization || '';
    const cacheKey = sha256(header).toString('hex');
    if ((verified.get(cacheKey) || 0) > now()) return 'ok';

    const credentials = parseBasicAuth(header);
    if (!credentials) return 'missing';
    // Always run scrypt, so a wrong user name takes as long as a wrong password.
    const passwordOk = verifyPassword(credentials.password, passwordHash);
    const userOk = crypto.timingSafeEqual(sha256(credentials.user), expectedUser);
    if (userOk && passwordOk) {
      if (verified.size > 1000) verified.clear();
      verified.set(cacheKey, now() + cacheMs);
      failures.delete(ip);
      return 'ok';
    }
    if (failures.size > 10_000) failures.clear();
    const current = failures.get(ip) || { count: 0, since: now() };
    failures.set(ip, { count: current.count + 1, since: current.since });
    return 'denied';
  }

  function middleware(req, res, next) {
    const result = check(req);
    if (result === 'ok') return next();
    if (result === 'locked') {
      res.set('Retry-After', String(Math.ceil(lockoutMs / 1000)));
      return res.status(429).send('Too many failed logins. Try again later.');
    }
    res.set('WWW-Authenticate', 'Basic realm="LocateCabs", charset="UTF-8"');
    return res.status(401).send('Authentication required.');
  }

  // Socket.IO `allowRequest` hook: runs on every handshake and polling request.
  function allowRequest(req, callback) {
    callback(null, check(req) === 'ok');
  }

  return { check, middleware, allowRequest };
}

module.exports = { hashPassword, verifyPassword, parseBasicAuth, createAuthenticator, clientIp };
