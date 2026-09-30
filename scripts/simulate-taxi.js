'use strict';

// Drives a simulated taxi along a short loop in Barranquilla, sending one signed
// datagram every two seconds, the same way the phone app would.
//   npm run simulate -- [device id] [host] [port]
const dgram = require('dgram');
const { parseDeviceKeys } = require('../src/config');
const { encodeDatagram } = require('../src/datagram');

const [id = 'taxi1', host = '127.0.0.1', port = process.env.UDP_PORT || '3020'] = process.argv.slice(2);
const key = parseDeviceKeys(process.env.DEVICE_KEYS || '').get(id);
if (!key) {
  console.error(`No key for "${id}" in DEVICE_KEYS. Run \`npm run init-env\` or add one to .env.`);
  process.exit(1);
}

const route = [
  [10.98472, -74.8113],
  [10.98561, -74.81052],
  [10.98649, -74.80975],
  [10.98594, -74.80873],
  [10.98503, -74.80942],
  [10.98422, -74.81018],
];

const socket = dgram.createSocket('udp4');
let step = 0;

function send() {
  const [lat, lon] = route[step % route.length];
  const datagram = encodeDatagram(key, { id, lat: lat.toFixed(5), lon: lon.toFixed(5), ts: Date.now() });
  socket.send(datagram, Number(port), host);
  console.log(`sent ${id} ${lat.toFixed(5)},${lon.toFixed(5)}`);
  step += 1;
}

send();
setInterval(send, 2000);
