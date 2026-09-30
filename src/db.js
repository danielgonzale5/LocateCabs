'use strict';

const mysql = require('mysql2/promise');

// Every query uses placeholders: request values never become part of the SQL text.
// `TimeStamp` is a VARCHAR holding unix time in ms (13 digits), so ranges are
// compared as strings of equal length, as the original schema did.
function createDb(options) {
  const pool = mysql.createPool({ ...options, connectionLimit: 5, waitForConnections: true, enableKeepAlive: true });

  return {
    async insertPosition({ id, lat, lon, ts }) {
      await pool.execute('INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp) VALUES (?, ?, ?, ?)', [
        id,
        String(lat),
        String(lon),
        String(ts),
      ]);
    },

    async latestPosition() {
      const [rows] = await pool.execute(
        "SELECT Usuario, Latitud, Longitud, TimeStamp FROM gps WHERE TimeStamp REGEXP '^[0-9]{13}$' ORDER BY idGPS DESC LIMIT 1",
      );
      return rows[0] || null;
    },

    async positionsBetween(from, to) {
      const [rows] = await pool.execute(
        'SELECT Latitud, Longitud FROM gps WHERE TimeStamp BETWEEN ? AND ? ORDER BY idGPS',
        [String(from), String(to)],
      );
      return rows;
    },

    async lastPositionBetween(from, to) {
      const [rows] = await pool.execute(
        'SELECT Latitud, Longitud FROM gps WHERE TimeStamp BETWEEN ? AND ? ORDER BY idGPS DESC LIMIT 1',
        [String(from), String(to)],
      );
      return rows[0] || null;
    },

    // Newest timestamp per device, to seed replay protection after a restart.
    async lastTimestamps() {
      const [rows] = await pool.execute(
        "SELECT Usuario, MAX(TimeStamp) AS ts FROM gps WHERE TimeStamp REGEXP '^[0-9]{13}$' GROUP BY Usuario",
      );
      return new Map(rows.map((row) => [row.Usuario, Number(row.ts)]));
    },

    close: () => pool.end(),
  };
}

module.exports = { createDb };
