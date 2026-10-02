// Test cases for sensitive-logging.yaml (semgrep --test).

const entvar = dotenv.config();
// ruleid: secrets-or-request-data-in-logs
console.log(entvar.parsed);

app.post('/login', function (req, res) {
  // ruleid: secrets-or-request-data-in-logs
  console.log(req.body);
  var Contra = req.body.pass.toString();
  // ruleid: secrets-or-request-data-in-logs
  console.log(User, Contra);
});

// ruleid: secrets-or-request-data-in-logs
console.log(process.env);

// ok: secrets-or-request-data-in-logs
console.log('El servidor esta escuchando el puerto ' + port);

// ok: secrets-or-request-data-in-logs
console.log('La contraseña no coincide');

// ruleid: secrets-or-request-data-in-logs
console.log(`Password:  ${password}`);

// ok: secrets-or-request-data-in-logs
log.info(`audit: user ${req.session.userId} viewed case ${found.idcaso}`);
