// Test cases for socketio.yaml (semgrep --test).

app.post('/consulta1', function (req, res) {
  con.query('SELECT 1', function (err, rows) {
    // ruleid: socketio-broadcast-in-request-handler
    io.emit('infocase', rows[0]);
  });
});

app.post('/Mapdraw1', (req, err) => {
  // ruleid: socketio-broadcast-in-request-handler
  io.emit('mapa', []);
});

app.post('/historic', async (req, res) => {
  const rows = await db.positionsBetween(1, 2);
  // ok: socketio-broadcast-in-request-handler
  res.json({ points: rows });
});

function publish(row) {
  // ok: socketio-broadcast-in-request-handler
  io.emit('change', row);
}

setInterval(function () {
  // ruleid: socketio-connection-listener-registered-repeatedly
  io.on('connection', function (socket) {
    socket.emit('change', {});
  });
}, 3000);

app.post('/historicact', function (req, res) {
  // ruleid: socketio-connection-listener-registered-repeatedly
  io.on('connection', function (socket) {});
});

// ok: socketio-connection-listener-registered-repeatedly
io.on('connection', (socket) => {
  if (latest) socket.emit('change', latest);
});
