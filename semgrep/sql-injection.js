// Test cases for sql-injection.yaml (semgrep --test).

app.post('/historic', function (req, res) {
  var TSini = req.body.datainicio.toString();
  var TSfin = req.body.datafin.toString();
  // ruleid: request-data-in-sql-text, sql-text-built-from-strings
  con.query("SELECT * FROM gps WHERE TimeStamp BETWEEN ('" + TSini + "') AND ('" + TSfin + "');", function (err, rows) {});
});

app.post('/login', function (req, res) {
  var User = req.body.user.toString();
  // ruleid: request-data-in-sql-text, sql-text-built-from-strings
  con.query(`SELECT * FROM usuarios WHERE usuario = '${User}'`, function (err, rows) {});
});

app.post('/consulta1', async (req, res) => {
  const cedula = req.body.ctcedu;
  // ok: request-data-in-sql-text, sql-text-built-from-strings
  await pool.execute('SELECT * FROM registro_pacientes WHERE cedula = ?', [cedula]);
});

async function findCase(idcaso) {
  const columns = 'idcaso, cedula, nombre';
  // ruleid: sql-text-built-from-strings
  return pool.execute(`SELECT ${columns} FROM registro_pacientes WHERE idcaso = ?`, [idcaso]);
}

// ok: request-data-in-sql-text, sql-text-built-from-strings
pool.execute(`SELECT COUNT(*) AS n
              FROM registro_pacientes`);
