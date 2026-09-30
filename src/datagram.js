'use strict';

const crypto = require('crypto');
const { DEVICE_ID } = require('./config');

// Wire format, one position per UDP datagram:
//   <device id>;<latitude>;<longitude>;<unix time in ms>;<hmac>
// where <hmac> is HMAC-SHA256 in hex, keyed with the device's own key, over
// everything before the last ';'.
const MAX_DATAGRAM_BYTES = 256;
const COORDINATE = /^-?\d{1,3}(\.\d{1,8})?$/;
const TIMESTAMP_MS = /^\d{13}$/;
const HMAC_HEX = /^[0-9a-f]{64}$/;

function sign(key, message) {
  return crypto.createHmac('sha256', key).update(message).digest();
}

function encodeDatagram(key, { id, lat, lon, ts }) {
  const message = `${id};${lat};${lon};${ts}`;
  return Buffer.from(`${message};${sign(key, message).toString('hex')}`);
}

// Returns verify(buffer) -> { ok: true, position } or { ok: false, reason }.
// `lastSeen` holds the newest accepted timestamp per device, so a captured
// datagram cannot be replayed. Seed it from the database at startup.
function createDatagramVerifier({ keys, maxSkewMs = 60_000, now = Date.now, lastSeen = new Map() }) {
  const reject = (reason) => ({ ok: false, reason });

  return function verify(buffer) {
    if (buffer.length > MAX_DATAGRAM_BYTES) return reject('too long');
    const parts = buffer.toString('utf8').split(';');
    if (parts.length !== 5) return reject('malformed');
    const [id, latText, lonText, tsText, mac] = parts;

    if (!DEVICE_ID.test(id)) return reject('invalid device id');
    const key = keys.get(id);
    if (!key) return reject('unknown device');
    if (!HMAC_HEX.test(mac)) return reject('malformed signature');
    const expected = sign(key, `${id};${latText};${lonText};${tsText}`);
    if (!crypto.timingSafeEqual(Buffer.from(mac, 'hex'), expected)) return reject('bad signature');

    if (!COORDINATE.test(latText) || !COORDINATE.test(lonText)) return reject('invalid coordinates');
    const lat = Number(latText);
    const lon = Number(lonText);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return reject('coordinates out of range');

    if (!TIMESTAMP_MS.test(tsText)) return reject('invalid timestamp');
    const ts = Number(tsText);
    if (Math.abs(now() - ts) > maxSkewMs) return reject('timestamp outside the allowed window');
    if (ts <= (lastSeen.get(id) || 0)) return reject('replayed or out of order');

    lastSeen.set(id, ts);
    return { ok: true, position: { id, lat, lon, ts } };
  };
}

module.exports = { createDatagramVerifier, encodeDatagram, MAX_DATAGRAM_BYTES };
