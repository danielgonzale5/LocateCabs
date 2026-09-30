'use strict';

// Prints the scrypt hash to put in APP_PASSWORD_HASH. The password is read from
// standard input, not from the command line, so it stays out of shell history
// and process listings:
//   npm run --silent hash-password < password.txt
const { hashPassword } = require('../src/auth');

let input = '';
process.stdin.setEncoding('utf8');
if (process.stdin.isTTY) process.stderr.write('Password, then Enter: ');
process.stdin.on('data', (chunk) => {
  input += chunk;
  if (process.stdin.isTTY && input.includes('\n')) process.stdin.pause();
});
process.stdin.on('pause', finish);
process.stdin.on('end', finish);

let done = false;
function finish() {
  if (done) return;
  done = true;
  const password = input.replace(/\r?\n$/, '');
  if (password.length < 12) {
    process.stderr.write('Use at least 12 characters.\n');
    process.exit(1);
  }
  process.stdout.write(`${hashPassword(password)}\n`);
}
