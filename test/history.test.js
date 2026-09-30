'use strict';

// LC-01: only well-formed timestamps ever reach the database layer.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHistoryRange, parseCurrentQuery } = require('../src/history');

const FROM = '1790000000000';
const TO = '1790003600000';

test('accepts a range of unix timestamps in ms, as strings or numbers', () => {
  assert.deepEqual(parseHistoryRange({ datainicio: FROM, datafin: TO }), { ok: true, from: 1790000000000, to: 1790003600000 });
  assert.equal(parseHistoryRange({ datainicio: Number(FROM), datafin: Number(TO) }).ok, true);
});

test('rejects SQL syntax and anything that is not 13 digits', () => {
  for (const bad of ["0'", "1790000000000' OR '1'='1", '179000000000', '1790000000000.5', '', null, [], {}, true]) {
    assert.equal(parseHistoryRange({ datainicio: bad, datafin: TO }).ok, false, `accepted ${JSON.stringify(bad)}`);
  }
});

test('rejects a missing body, a reversed range and a range over 31 days', () => {
  assert.equal(parseHistoryRange(undefined).ok, false);
  assert.equal(parseHistoryRange({ datainicio: TO, datafin: FROM }).ok, false);
  assert.equal(parseHistoryRange({ datainicio: FROM, datafin: String(Number(FROM) + 32 * 86_400_000) }).ok, false);
});

test('the current-position query looks back 100 seconds', () => {
  assert.deepEqual(parseCurrentQuery({ dataactual: TO }), { ok: true, from: 1790003500000, to: 1790003600000 });
  assert.equal(parseCurrentQuery({ dataactual: "0'" }).ok, false);
});
