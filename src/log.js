'use strict';

// Events only, never request bodies, query results or configuration values.
function write(stream, level, message) {
  stream.write(`${new Date().toISOString()} ${level} ${message}\n`);
}

const log = {
  info: (message) => write(process.stdout, 'INFO', message),
  warn: (message) => write(process.stderr, 'WARN', message),
  error: (message) => write(process.stderr, 'ERROR', message),
};

const silentLog = { info() {}, warn() {}, error() {} };

module.exports = { log, silentLog };
