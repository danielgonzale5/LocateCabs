'use strict';

const dgram = require('dgram');

// Receives signed position datagrams. Nothing is sent back, and rejections are
// logged as a per-minute summary so a flood of junk cannot flood the logs too.
function createUdpReceiver({ verify, onPosition, log, summaryMs = 60_000 }) {
  const socket = dgram.createSocket('udp4');
  let rejected = new Map();

  socket.on('message', (msg) => {
    const result = verify(msg);
    if (!result.ok) {
      rejected.set(result.reason, (rejected.get(result.reason) || 0) + 1);
      return;
    }
    Promise.resolve(onPosition(result.position)).catch((err) => {
      log.error(`udp: could not store a position (${err.code || err.message})`);
    });
  });
  socket.on('error', (err) => log.error(`udp: socket error (${err.code || err.message})`));

  const timer = setInterval(() => {
    if (rejected.size === 0) return;
    const summary = [...rejected].map(([reason, count]) => `${reason}: ${count}`).join(', ');
    log.warn(`udp: rejected datagrams in the last ${summaryMs / 1000} s (${summary})`);
    rejected = new Map();
  }, summaryMs);
  timer.unref();

  return {
    socket,
    listen: (port, host) => new Promise((resolve) => socket.bind(port, host, resolve)),
    close: () => {
      clearInterval(timer);
      return new Promise((resolve) => socket.close(resolve));
    },
  };
}

module.exports = { createUdpReceiver };
