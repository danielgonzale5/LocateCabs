'use strict';

const crypto = require('crypto');
const { execFile } = require('child_process');

// GitHub signs each delivery: X-Hub-Signature-256: sha256=<HMAC-SHA256 of the raw body>.
function verifyGithubSignature(secret, rawBody, header) {
  if (!secret || typeof header !== 'string') return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const received = Buffer.from(header);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

// Express handler for POST /github. Mount it with express.raw() so the signature
// is checked against the exact bytes GitHub sent.
function createWebhookHandler({ secret, branch, deploy, log }) {
  return function githubWebhook(req, res) {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!verifyGithubSignature(secret, body, req.get('X-Hub-Signature-256'))) {
      log.warn('webhook: rejected a delivery with a missing or invalid signature');
      return res.status(401).json({ error: 'invalid signature' });
    }
    const event = req.get('X-GitHub-Event');
    if (event === 'ping') return res.status(204).end();
    if (event !== 'push') return res.status(202).json({ status: 'ignored' });

    let payload;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'invalid JSON' });
    }
    if (payload.ref !== `refs/heads/${branch}`) return res.status(202).json({ status: 'ignored' });

    res.status(202).json({ status: 'deploying' });
    deploy();
  };
}

// Updates the checkout in `dir` to origin/<branch>. No shell is involved, and a
// burst of deliveries collapses into at most one extra run.
function createGitDeployer({ dir, branch, log, run = execFile }) {
  let running = false;
  let pending = false;

  const git = (args) =>
    new Promise((resolve, reject) => {
      run('git', ['-C', dir, ...args], { timeout: 120_000 }, (err) => (err ? reject(err) : resolve()));
    });

  async function deploy() {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      do {
        pending = false;
        await git(['fetch', '--quiet', 'origin', branch]);
        await git(['reset', '--hard', '--quiet', `origin/${branch}`]);
        log.info(`deploy: updated to origin/${branch}`);
      } while (pending);
    } catch (err) {
      log.error(`deploy: git failed (${err.code || err.message})`);
    } finally {
      running = false;
    }
  }

  return deploy;
}

module.exports = { verifyGithubSignature, createWebhookHandler, createGitDeployer };
