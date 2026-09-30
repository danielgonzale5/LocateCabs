'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { parseHistoryRange, parseCurrentQuery } = require('./history');
const { createWebhookHandler } = require('./webhook');

// Pages may only run scripts served by this app or the pinned, SRI-checked Leaflet
// files from unpkg. Inline <script> and on* attributes are refused.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://cdnjs.cloudflare.com",
  "img-src 'self' data: https://*.tile.openstreetmap.org https://api.mapbox.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  "connect-src 'self' https://api.mapbox.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    // OpenStreetMap's tile policy requires a Referer; send the origin only, never the path.
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
}

function toLivePayload(row) {
  return {
    DataUsu: row.Usuario,
    DataLat: Number(row.Latitud).toFixed(6),
    DataLong: Number(row.Longitud).toFixed(6),
    DataTime: Number(row.TimeStamp),
  };
}

function createServer({ config, db, authenticator, deploy, log, root = path.join(__dirname, '..') }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  // GitHub authenticates with an HMAC signature, not with the operator login.
  // Without a secret the route does not exist.
  if (config.webhook.secret && deploy) {
    app.post(
      '/github',
      express.raw({ type: () => true, limit: '1mb' }),
      createWebhookHandler({ secret: config.webhook.secret, branch: config.webhook.branch, deploy, log }),
    );
  }

  app.use(authenticator.middleware);
  app.use(express.json({ limit: '10kb' }));

  const files = {
    '/': 'index.html',
    '/historicos': 'historicos.html',
    '/routing': 'index_routingmachine.html',
    '/logo.png': 'logo.png',
    '/favicon.ico': 'favicon.ico',
    '/bg.png': 'bg.png',
    '/github.svg': 'github.svg',
  };
  for (const [route, file] of Object.entries(files)) {
    app.get(route, (req, res) => res.sendFile(path.join(root, file)));
  }
  app.use('/js', express.static(path.join(root, 'js'), { index: false }));

  // History results go back to the browser that asked, and nowhere else.
  app.post('/historic', async (req, res) => {
    const range = parseHistoryRange(req.body);
    if (!range.ok) return res.status(400).json({ error: range.error });
    const rows = await db.positionsBetween(range.from, range.to);
    log.info(`http: history query returned ${rows.length} points`);
    res.json({ points: rows.map((row) => [Number(row.Latitud), Number(row.Longitud)]) });
  });

  app.post('/historicact', async (req, res) => {
    const query = parseCurrentQuery(req.body);
    if (!query.ok) return res.status(400).json({ error: query.error });
    const row = await db.lastPositionBetween(query.from, query.to);
    res.json({ point: row ? [Number(row.Latitud), Number(row.Longitud)] : null });
  });

  app.use((req, res) => res.status(404).send('Not found.'));

  // Errors end the request, never the process.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) log.error(`http: ${req.method} ${req.path} failed (${err.code || err.message})`);
    res.status(status).json({ error: status < 500 && err.expose ? err.message : 'internal error' });
  });

  const server = http.createServer(app);
  const io = new Server(server, { allowRequest: authenticator.allowRequest, maxHttpBufferSize: 10_000 });

  // One connection handler for the life of the process: a new browser gets the
  // latest position once, then every update as it arrives.
  let latest = null;
  io.on('connection', (socket) => {
    if (latest) socket.emit('change', latest);
  });

  function publish(row) {
    latest = toLivePayload(row);
    io.emit('change', latest);
  }

  return { app, server, io, publish };
}

module.exports = { createServer, CONTENT_SECURITY_POLICY };
