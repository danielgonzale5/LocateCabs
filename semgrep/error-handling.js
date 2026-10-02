// Test cases for error-handling.yaml (semgrep --test).

con.query('SELECT 1', function (err, rows) {
  // ruleid: throw-inside-async-callback
  if (err) throw err;
});

con.query('SELECT 1', (err, rows) => {
  // ruleid: throw-inside-async-callback
  if (err) throw err;
});

con.query('SELECT 1', function (err, rows) {
  if (err) {
    // ok: throw-inside-async-callback
    log.error('query failed');
    return;
  }
});

con.query('SELECT * FROM registro_pacientes WHERE cedula = ?', [cedula], function (err, rows) {
  // ruleid: first-row-used-without-check
  var CeduData = JSON.parse(JSON.stringify(rows[0]));
});

con.query('SELECT * FROM usuarios WHERE usuario = ?', [user], function (err, rows) {
  if (rows.length != 0) {
    // ok: first-row-used-without-check
    var UData = JSON.parse(JSON.stringify(rows[0]));
  }
});
