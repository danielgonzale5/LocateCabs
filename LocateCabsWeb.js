//Inicialización Variables Globales
const express = require('express');
var app = require('express')();
var server = require('http').createServer(app);
var systemchild = require("child_process");
const port = 3000
var DatosGPS;
var udp = require('dgram');
var dir = __dirname;
var io = require('socket.io')(server);
//Metodos de conección Frontend-Backend, Rutas
app.post('/github', function (req, res) {
  console.log("received")
  systemchild.exec("cd /home/ubuntu/LocateCabs && git reset --hard && git pull")
});
app.get('/', function (req, res) {
  res.sendfile(dir + '/index.html');
});
app.get('/routing', function (req, res) {
  res.sendfile(dir + '/index_routingmachine.html');
});
app.get('/historicos', function (req, res) {
  res.sendfile(dir + '/historicos.html');
});
//Conexión al puerto establecido
server.listen(port, function (error) {
  if (error) {
    console.log('Hay un error', error)
  } else {
    console.log('El servidor esta escuchando el puerto ' + port)
  }
})
//Variables de entorno
dotenv = require('dotenv')
const entvar = dotenv.config()

if (entvar.error) {
  throw result.error
}
console.log(entvar.parsed)
//Conexión Base de datos
const mysql = require('mysql')
var data;
var con = mysql.createConnection({
  host: entvar.parsed.DB_HOST,
  user: entvar.parsed.DB_USER,
  password: entvar.parsed.DB_PASS,
  database: 'locatecabs'
})
con.connect((err) => {
  if (err) {
    console.log('hay un error de conexión con la base de datos')
  } else {
    console.log('la conexión con la base de datos funciona')
  }
})
//Ingreso de variables ppro defecto
var Imysql = "INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp) VALUES ?";
var values = [
  ["-", "-", "-", "-"],
];
con.query(Imysql, [values], function (err) {
  if (err) throw err;
});
// Creación Server UDP
var serverudp = udp.createSocket('udp4');
serverudp.on('error', function (error) {
  console.log('Error: ' + error);
  serverudp.close();
});
// Mensaje para informar recepción de mensajes en consola
serverudp.on('message', function (msg, info) {
  console.log('Data received from client : ' + msg.toString());
  console.log('Received %d bytes from %s:%d\n', msg.length, info.address, info.port);
  // Envio de mensaje
  serverudp.send(msg, info.port, 'localhost', function (error) {
    if (error) {
      client.close();
    } else {
      console.log('Data sent !!!');
    }
  });
  //Almacenamiento de mensaje en Base de datos
  DatosGPS = msg.toString().split(";")
  var Imysql = "INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp) VALUES ?";
  var values = [
    [DatosGPS[0], DatosGPS[1], DatosGPS[2], DatosGPS[3]]];
  con.query(Imysql, [values], function (err, result) {
    if (err) throw err;
    console.log("Records inserted: " + result.affectedRows);
  });
});
//Mensaje de cierre del socket (Servidor UDP)
serverudp.on('close', function () {
  console.log('Socket is closed !');
});
//Puerto 3020
serverudp.bind(3020);
//Tiempo de espera para el cierre del socket
setTimeout(function () {
  serverudp.close();
}, 999999999);
//Consulta a la base de datos y conexión constante Backend-Frontend
setInterval(function () {
  con.query('SELECT * FROM gps ORDER BY idGPS DESC LIMIT 1', function (err, rows) {
    if (err) throw err;
    data = JSON.parse(JSON.stringify(rows))
    var dataGPS = Object.values(data[0])
    var DataUsu = dataGPS[1]
    var DataLat = parseFloat(dataGPS[2]).toFixed(6)
    var DataLong = parseFloat(dataGPS[3]).toFixed(6)
    var DataTime = parseFloat(dataGPS[4])
    io.emit('change', {
      DataUsu: DataUsu,
      DataLat: DataLat,
      DataLong: DataLong,
      DataTime: DataTime,
    });
    io.on('connection', function (socket) {
      socket.emit('change', {
        DataUsu: DataUsu,
        DataLat: DataLat,
        DataLong: DataLong,
        DataTime: DataTime,
      });
    });
  });
}, 3000);
app.use(express.json({ limit: '500mb' }));
app.post('/historic', function (req, res) {
  console.log("Historics sended")
  console.log(req.body);
  var HisDat = req.body;
  var TSini = HisDat.datainicio.toString();
  var TSfin = HisDat.datafin.toString();
  console.log(TSini, TSfin)
  con.query("SELECT * FROM gps WHERE TimeStamp BETWEEN ('" + TSini + "') AND ('" + TSfin + "');", function (err, rows) {
    if (err) throw err;
    var HistData = JSON.parse(JSON.stringify(rows))
    var DataHist = Object.values(HistData)
    var ConverArray = []
    var CoordinatesArrTemp = []
    var CoordinatesArr = []
    console.log(DataHist)
    for (var i = 0; i < DataHist.length; i++) {
      ConverArray.push(Object.values(DataHist[i]))
    }
    console.log(ConverArray)
    for (var j = 0; j < DataHist.length; j++) {
      CoordinatesArrTemp = [ConverArray[j][2], ConverArray[j][3]];
      CoordinatesArr.push(CoordinatesArrTemp);
    }
    var DataTimeStamp = CoordinatesArr
    io.emit('timestamp', {
      DataTimeStamp: DataTimeStamp,
    });
    io.on('connection', function (socket) {
      socket.emit('timestamp', {
        DataTimeStamp: DataTimeStamp
      });
    });
  });
  res.json({
    status: 'received'
  });
});
app.post('/historicact', function (req, res) {
  console.log("Actual Historic sended")
  console.log(req.body);
  var HisDatact = req.body;
  var TSact = HisDatact.dataactual.toString();
  console.log(TSact)
  var TSactant = parseInt(TSact)-60000;
  console.log(TSactant)
  var TSactant = TSactant.toString();
  console.log(TSactant)
  con.query("SELECT * FROM gps WHERE TimeStamp BETWEEN ('" + TSactant + "') AND ('" + TSact + "');", function (err, rows) {
    if (err) throw err;
    var HistDataact = JSON.parse(JSON.stringify(rows))
    console.log(HistDataact)
    var DataHistact = Object.values(HistDataact)
    var ActConverArray = []
    var CCoordinatesArr = []
    console.log(DataHistact)
    for (var i = 0; i < DataHistact.length; i++) {
      ActConverArray.push(Object.values(DataHistact[i]))
    }
    console.log(ActConverArray)
    CCoordinatesArr=[ActConverArray[DataHistact.length-1][2],ActConverArray[DataHistact.length-1][3]]
    var CurrentDataTimeStamp = CCoordinatesArr
    console.log(CurrentDataTimeStamp)
    io.emit('ctimestamp', {
      CurrentDataTimeStamp: CurrentDataTimeStamp,
    });
    io.on('connection', function (socket) {
      socket.emit('ctimestamp', {
        CurrentDataTimeStamp: CurrentDataTimeStamp
      });
    });
  });
  res.json({
    status: 'received'
  });
});