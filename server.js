'use strict';

const { loadConfig } = require('./src/config');
const { createDb } = require('./src/db');
const { createAuthenticator } = require('./src/auth');
const { createDatagramVerifier } = require('./src/datagram');
const { createUdpReceiver } = require('./src/udp');
const { createGitDeployer } = require('./src/webhook');
const { createServer } = require('./src/app');
const { log } = require('./src/log');

async function main() {
  const config = loadConfig();
  const db = createDb(config.db);
  const authenticator = createAuthenticator({ ...config.auth, trustProxy: config.trustProxy });

  let deploy = null;
  if (config.webhook.secret) {
    if (!config.webhook.deployDir) throw new Error('GITHUB_WEBHOOK_SECRET is set but DEPLOY_DIR is not');
    deploy = createGitDeployer({ dir: config.webhook.deployDir, branch: config.webhook.branch, log });
  }

  const { server, io, publish } = createServer({ config, db, authenticator, deploy, log });

  const latest = await db.latestPosition();
  if (latest) publish(latest);

  if (config.deviceKeys.size === 0) log.warn('udp: DEVICE_KEYS is empty, every datagram will be rejected');
  const verify = createDatagramVerifier({ keys: config.deviceKeys, lastSeen: await db.lastTimestamps() });
  const udp = createUdpReceiver({
    verify,
    log,
    onPosition: async (position) => {
      await db.insertPosition(position);
      publish({ Usuario: position.id, Latitud: position.lat, Longitud: position.lon, TimeStamp: position.ts });
    },
  });

  await udp.listen(config.udpPort);
  await new Promise((resolve) => server.listen(config.httpPort, resolve));
  log.info(`http: listening on port ${config.httpPort}, udp: listening on port ${config.udpPort}`);
  log.info(`webhook: ${deploy ? `enabled for ${config.webhook.branch}` : 'disabled (no GITHUB_WEBHOOK_SECRET)'}`);

  const shutdown = async (signal) => {
    log.info(`${signal} received, shutting down`);
    io.close();
    await udp.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error(`startup failed: ${err.message}`);
  process.exit(1);
});
