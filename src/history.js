'use strict';

const TIMESTAMP_MS = /^\d{13}$/;
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
// The "where was the taxi at time T" query looks back this far from T.
const CURRENT_LOOKBACK_MS = 100_000;

function toTimestamp(value) {
  const text = typeof value === 'number' ? String(value) : value;
  return typeof text === 'string' && TIMESTAMP_MS.test(text) ? Number(text) : null;
}

// Body of POST /historic: { datainicio, datafin } as unix time in ms.
function parseHistoryRange(body) {
  const from = toTimestamp(body && body.datainicio);
  const to = toTimestamp(body && body.datafin);
  if (from === null || to === null) return { ok: false, error: 'datainicio and datafin must be unix time in milliseconds' };
  if (from > to) return { ok: false, error: 'datainicio must not be after datafin' };
  if (to - from > MAX_RANGE_MS) return { ok: false, error: 'the range must not exceed 31 days' };
  return { ok: true, from, to };
}

// Body of POST /historicact: { dataactual } as unix time in ms.
function parseCurrentQuery(body) {
  const at = toTimestamp(body && body.dataactual);
  if (at === null) return { ok: false, error: 'dataactual must be unix time in milliseconds' };
  return { ok: true, from: at - CURRENT_LOOKBACK_MS, to: at };
}

module.exports = { parseHistoryRange, parseCurrentQuery, MAX_RANGE_MS };
