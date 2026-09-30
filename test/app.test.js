'use strict';

// End-to-end checks against the HTTP and Socket.IO server with an in-memory database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { createServer } = require('../src/app');
const { createAuthenticator, hashPassword } = require('../src/auth');
const { silentLog } = require('../src/log');

const PASSWORD = 'correct horse battery';
const AUTH = `Basic ${Buffer.from(`operator:${PASSWORD}`).toString('base64')}`;
const passwordHash = hashPassword(PASSWORD);

function fakeDb(rows = []) {
  const calls = [];
  return {
    calls,
    failNext: false,
    async positionsBetween(from, to) {
      calls.push(['positionsBetween', from, to]);
      if (this.failNext) {
        this.failNext = false;
        throw Object.assign(new Error('connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' });
      }
      return rows;
    },
    async lastPositionBetween(from, to) {
      calls.push(['lastPositionBetween', from, to]);
      return rows.at(-1) || null;
    },
  };
}

async function start(db = fakeDb(), webhook = { secret: '', branch: 'master' }) {
  const authenticator = createAuthenticator({ user: 'operator', passwordHash });
  const instance = createServer({ config: { webhook }, db, authenticator, deploy: () => {}, log: silentLog });
  await new Promise((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${instance.server.address().port}`;
  const stop = () => {
    instance.io.close();
    return new Promise((resolve) => instance.server.close(resolve));
  };
  return { ...instance, base, db, stop };
}

const post = (base, path, body, headers = { authorization: AUTH }) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('LC-03: pages and APIs require the operator login', async (t) => {
  const app = await start();
  t.after(app.stop);
  const anonymous = await fetch(`${app.base}/`);
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get('www-authenticate'), /^Basic/);
  assert.equal((await post(app.base, '/historic', {}, {})).status, 401);
  assert.equal((await fetch(`${app.base}/`, { headers: { authorization: AUTH } })).status, 200);
});

test('LC-07: responses carry a CSP that blocks inline script', async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await fetch(`${app.base}/`, { headers: { authorization: AUTH } });
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' https:\/\/unpkg\.com(;|$)/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('LC-01: SQL syntax in a date is refused before it reaches the database', async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await post(app.base, '/historic', { datainicio: "0'", datafin: '1790000000000' });
  assert.equal(res.status, 400);
  assert.equal(app.db.calls.length, 0);
});

test('LC-09: history rows are returned to the caller, not broadcast', async (t) => {
  const app = await start(fakeDb([{ Latitud: '10.98472', Longitud: '-74.81130' }]));
  t.after(app.stop);
  const bystander = connect(app.base, { extraHeaders: { authorization: AUTH }, transports: ['polling'] });
  t.after(() => bystander.close());
  await new Promise((resolve) => bystander.on('connect', resolve));
  const events = [];
  bystander.onAny((name) => events.push(name));

  const res = await post(app.base, '/historic', { datainicio: '1790000000000', datafin: '1790003600000' });
  assert.deepEqual(await res.json(), { points: [[10.98472, -74.8113]] });
  assert.deepEqual(app.db.calls, [['positionsBetween', 1790000000000, 1790003600000]]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.deepEqual(events, []);
});

test('LC-04: a database error returns 500 and the server keeps serving', async (t) => {
  const app = await start(fakeDb([]));
  t.after(app.stop);
  app.db.failNext = true;
  const failed = await post(app.base, '/historic', { datainicio: '1790000000000', datafin: '1790003600000' });
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: 'internal error' });
  const next = await post(app.base, '/historic', { datainicio: '1790000000000', datafin: '1790003600000' });
  assert.equal(next.status, 200);
});

test('LC-04: request bodies over 10 KB are refused', async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await post(app.base, '/historic', JSON.stringify({ pad: 'x'.repeat(20_000) }));
  assert.equal(res.status, 413);
});

test('LC-03: Socket.IO refuses a handshake without the login', async (t) => {
  const app = await start();
  t.after(app.stop);
  const socket = connect(app.base, { transports: ['polling'], reconnection: false });
  t.after(() => socket.close());
  const error = await new Promise((resolve) => socket.on('connect_error', resolve));
  assert.ok(error);
});

test('LC-04: a new browser gets the latest position once, however many updates came before', async (t) => {
  const app = await start();
  t.after(app.stop);
  for (let i = 0; i < 20; i += 1) {
    app.publish({ Usuario: 'taxi1', Latitud: '10.9', Longitud: '-74.8', TimeStamp: String(1790000000000 + i) });
  }
  const socket = connect(app.base, { extraHeaders: { authorization: AUTH }, transports: ['polling'] });
  t.after(() => socket.close());
  const received = [];
  socket.on('change', (data) => received.push(data));
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(received.length, 1);
  assert.equal(received[0].DataTime, 1790000000019);
  assert.equal(app.io.listeners('connection').length, 1);
});

test('LC-06: without a secret the webhook route does not exist', async (t) => {
  const app = await start();
  t.after(app.stop);
  const res = await post(app.base, '/github', { ref: 'refs/heads/master' }, { authorization: AUTH, 'x-github-event': 'push' });
  assert.equal(res.status, 404);
});
