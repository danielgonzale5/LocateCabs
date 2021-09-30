const express = require('express');
var app = require('express')();
var server = require('http').createServer(app);
var systemchild = require("child_process"); //Variable que requiere un child process

const port = 3000
var DatosGPS;

var udp = require('dgram');

var dir = __dirname;

app.post('/github', function (req, res) {
  console.log("received")// muestra los datos en la consola 
  systemchild.exec("cd /home/ubuntu/LocateCabs && git reset --hard && git pull")// se realiza el proceso en la terminal 
});//automatizacion de github

app.get('/', function (req, res) {
  res.sendfile(dir + '/index.html');
});

app.get('/routing', function(req, res) {
  res.sendfile(dir + '/index_routingmachine.html');
});

var io = require('socket.io')(server);

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

var Imysql = "INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp) VALUES ?";
var values = [
  ["-", "-", "-", "-"],
];

con.query(Imysql, [values], function (err) {
  if (err) throw err;
});



// creating a udp server
var serverudp = udp.createSocket('udp4');



// emits when any error occurs
serverudp.on('error', function (error) {
  console.log('Error: ' + error);
  serverudp.close();
});

// emits on new datagram msg
serverudp.on('message', function (msg, info) {
  console.log('Data received from client : ' + msg.toString());
  console.log('Received %d bytes from %s:%d\n', msg.length, info.address, info.port);
  //sending msg
  serverudp.send(msg, info.port, 'localhost', function (error) {
    if (error) {
      client.close();
    } else {
      console.log('Data sent !!!');
    }
  });

  DatosGPS = msg.toString().split(";")

  var Imysql = "INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp) VALUES ?";
  var values = [
    [DatosGPS[0], DatosGPS[1], DatosGPS[2], DatosGPS[3]]];
  con.query(Imysql, [values], function (err, result) {
    if (err) throw err;
    console.log("Records inserted: " + result.affectedRows);

  });
});
//emits after the socket is closed using socket.close();
serverudp.on('close', function () {
  console.log('Socket is closed !');
});

serverudp.bind(3020);

setTimeout(function () {
  serverudp.close();
}, 999999999);

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
// comunicacion fronted y backend
app.use(express.json({limit: '2mb'}));
app.post('/historic', function (req, res) {
  console.log("Historics sended")
  console.log(req.body);
  //Declaracion de variables, recibidas por el packet JSon 
  var HisDat = req.body;
  var UserData=HisDat.datausua.toString();
  var TSini=HisDat.datainicio.toString();
  var TSfin=HisDat.datafin.toString();
  console.log(UserData, TSini, TSfin)// muestra los datos en la consola 
  con.query("SELECT * FROM gps WHERE Usuario=('"+UserData+"') AND TimeStamp BETWEEN ('"+TSini+"') AND ('"+TSfin+"');", function (err, rows) {
    if (err) throw err;
    // Declaracion de variables
    var HistData = JSON.parse(JSON.stringify(rows))
    var DataHist = Object.values(HistData)
    var ConverArray =[]
    var CoordinatesArrTemp = []
    var CoordinatesArr = []
    console.log(DataHist)
    //Llenado del vector de objeos
    for (var i = 0; i < DataHist.length; i++) {
      ConverArray.push(Object.values(DataHist[i]))
   }
   console.log(ConverArray)
     //LLenado del vector que contiene lon y lat
    for (var j = 0; j < DataHist.length; j++) {
      CoordinatesArrTemp = [ConverArray[j][2],ConverArray[j][3]];
      CoordinatesArr.push(CoordinatesArrTemp);
    }
    var DataTimeStamp= CoordinatesArr
     // envia al Index
    io.emit('timestamp', {
      DataTimeStamp: DataTimeStamp,
    });
    io.on('connection', function (socket) {
      socket.emit('timestamp', {
        DataTimeStamp: DataTimeStamp
      });
    });
  });
});