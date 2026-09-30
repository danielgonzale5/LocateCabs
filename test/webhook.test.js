'use strict';

// LC-06: the deploy webhook only runs for signed pushes to the deploy branch.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { verifyGithubSignature, createWebhookHandler, createGitDeployer } = require('../src/webhook');
const { silentLog } = require('../src/log');

const SECRET = 'webhook-test-secret';
const sign = (body, secret = SECRET) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

function call(handler, { body, headers }) {
  const raw = Buffer.from(body);
  const req = { body: raw, get: (name) => headers[name] };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
    end() {
      return this;
    },
  };
  handler(req, res);
  return res.statusCode;
}

function setup() {
  let deploys = 0;
  const handler = createWebhookHandler({ secret: SECRET, branch: 'master', deploy: () => (deploys += 1), log: silentLog });
  return { handler, deploys: () => deploys };
}

const push = (ref) => JSON.stringify({ ref });

test('verifies the X-Hub-Signature-256 header', () => {
  const body = Buffer.from('{"a":1}');
  assert.equal(verifyGithubSignature(SECRET, body, sign(body)), true);
  assert.equal(verifyGithubSignature(SECRET, body, sign(body, 'other')), false);
  assert.equal(verifyGithubSignature(SECRET, body, sign(body).replace('sha256=', 'sha1=')), false);
  assert.equal(verifyGithubSignature(SECRET, body, undefined), false);
  assert.equal(verifyGithubSignature('', body, sign(body, '')), false);
});

test('an unsigned request gets 401 and deploys nothing', () => {
  const { handler, deploys } = setup();
  assert.equal(call(handler, { body: push('refs/heads/master'), headers: { 'X-GitHub-Event': 'push' } }), 401);
  assert.equal(deploys(), 0);
});

test('a signed push to master is accepted with 202 and deploys once', () => {
  const { handler, deploys } = setup();
  const body = push('refs/heads/master');
  assert.equal(call(handler, { body, headers: { 'X-GitHub-Event': 'push', 'X-Hub-Signature-256': sign(body) } }), 202);
  assert.equal(deploys(), 1);
});

test('signed pushes to other branches and other events deploy nothing', () => {
  const { handler, deploys } = setup();
  const body = push('refs/heads/feature');
  assert.equal(call(handler, { body, headers: { 'X-GitHub-Event': 'push', 'X-Hub-Signature-256': sign(body) } }), 202);
  const issue = '{}';
  assert.equal(call(handler, { body: issue, headers: { 'X-GitHub-Event': 'issues', 'X-Hub-Signature-256': sign(issue) } }), 202);
  assert.equal(deploys(), 0);
});

test('the deployer runs git without a shell and never twice at the same time', async () => {
  const calls = [];
  let release;
  const run = (file, args, options, callback) => {
    calls.push([file, ...args]);
    if (calls.length === 1) release = callback;
    else callback(null);
  };
  const deploy = createGitDeployer({ dir: '/srv/locatecabs', branch: 'master', log: silentLog, run });
  const first = deploy();
  deploy();
  deploy();
  assert.equal(calls.length, 1);
  release(null);
  await first;
  assert.deepEqual(calls, [
    ['git', '-C', '/srv/locatecabs', 'fetch', '--quiet', 'origin', 'master'],
    ['git', '-C', '/srv/locatecabs', 'reset', '--hard', '--quiet', 'origin/master'],
    ['git', '-C', '/srv/locatecabs', 'fetch', '--quiet', 'origin', 'master'],
    ['git', '-C', '/srv/locatecabs', 'reset', '--hard', '--quiet', 'origin/master'],
  ]);
});
