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
io.setMaxListeners(0);
//Metodos de conección Frontend-Backend, Rutas
app.post('/github', function (req, res) {
  console.log("received")
  systemchild.exec("cd /home/ubuntu/LocateCabs && git reset --hard && git pull")
});
app.get('/', function (req, res) {
  res.sendfile(dir + '/index.html');
});
app.get('/logo.png', function (req, res) {
  res.sendfile(dir + '/logo.png');
});
app.get('/favicon.ico', function (req, res) {
  res.sendfile(dir + '/favicon.ico');
});
app.get('/bg.png', function (req, res) {
  res.sendfile(dir + '/bg.png');
});
app.get('/github.svg', function (req, res) {
  res.sendfile(dir + '/github.svg');
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

let Usersvec;

//Consulta a la base de datos por primera vez y manda el vector de usuarios para la lista desplegable----
setTimeout(function(){

  con.query('SELECT DISTINCT Usuario FROM gps ORDER BY Usuario', function(err, users){

    if (err) throw err;
    Usersvec = users.map(e=> e.Usuario);
    console.log('El vector de usuarios inicial es:'); 
    console.log(Usersvec);

    io.on('connection', function (socket) {
      socket.emit('init_users', {
        Usersvec: Usersvec
      });
    });

  });

}, 0);

//Ingreso de variables ppro defecto
var Imysql = "INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp, RPM) VALUES ?";
var values = [
  ["-", "-", "-", "-", "-"],
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
  var Imysql = "INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp, RPM) VALUES ?";
  var values = [
    [DatosGPS[0], DatosGPS[1], DatosGPS[2], DatosGPS[3], DatosGPS[4]]];
  con.query(Imysql, [values], function (err, result) {
    if (err) throw err;
    console.log("Records inserted: " + result.affectedRows);
    
  });

  
      
    con.query('SELECT DISTINCT Usuario FROM gps ORDER BY Usuario', function(err, users){

      if (err) throw err;
      Usersvec = users.map(e=> e.Usuario);

    });

    if (!Usersvec.includes(DatosGPS[0])){
    io.emit('new_user_detected', {
      Newuser: DatosGPS[0]
    });
    }

});
//Mensaje de cierre del socket (Servidor UDP)
serverudp.on('close', function () {
  console.log('Socket is closed !');
});
//Puerto 3020
serverudp.bind(3020);

//Consulta a la base de datos y conexión constante Backend-Frontend
setInterval(function () {
  con.query('SELECT * FROM gps WHERE Usuario = 1 ORDER BY idGPS DESC LIMIT 1', function (err, rows) {
    if (err) throw err;
    data = JSON.parse(JSON.stringify(rows))
    var dataGPS = Object.values(data[0])
    var DataUsu = dataGPS[1]
    var DataLat = parseFloat(dataGPS[2]).toFixed(6)
    var DataLong = parseFloat(dataGPS[3]).toFixed(6)
    var DataTime = parseFloat(dataGPS[4])
    var DataRPM = parseFloat(dataGPS[5])
    io.emit('change1', {
      DataUsu: DataUsu,
      DataLat: DataLat,
      DataLong: DataLong,
      DataTime: DataTime,
      DataRPM: DataRPM,
    });
    io.on('connection', function (socket) {
      socket.emit('change1', {
        DataUsu: DataUsu,
        DataLat: DataLat,
        DataLong: DataLong,
        DataTime: DataTime,
        DataRPM: DataRPM,
      });
    });
  });
}, 1500);

setInterval(function () {
    con.query('SELECT * FROM gps WHERE Usuario = 2 ORDER BY idGPS DESC LIMIT 1', function (err, rows) {
      if (err) throw err;
      data = JSON.parse(JSON.stringify(rows))
      var dataGPS = Object.values(data[0])
      var DataUsu = dataGPS[1]
      var DataLat = parseFloat(dataGPS[2]).toFixed(6)
      var DataLong = parseFloat(dataGPS[3]).toFixed(6)
      var DataTime = parseFloat(dataGPS[4])
      var DataRPM = parseFloat(dataGPS[5])
      io.emit('change2', {
        DataUsu: DataUsu,
        DataLat: DataLat,
        DataLong: DataLong,
        DataTime: DataTime,
        DataRPM: DataRPM,
      });
      io.on('connection', function (socket) {
        socket.emit('change2', {
          DataUsu: DataUsu,
          DataLat: DataLat,
          DataLong: DataLong,
          DataTime: DataTime,
          DataRPM: DataRPM,
        });
      });
    });
  }, 1500);

//Consulta nuevamente la base de datos y conexión constante Backend-Frontend (Históricos)
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

  
}, 1500);

app.use(express.json({limit: '200mb'}));

app.post('/historic', function (req, res) {
  console.log("Historics sending")
  //console.log(req.body);
  var HisDat = req.body;
  var TSini = HisDat.datainicio.toString();
  var TSfin = HisDat.datafin.toString();
  var TSuser = HisDat.datauser.toString();
  //console.log(TSini, TSfin, TSuser)
  con.query("SELECT * FROM gps WHERE TimeStamp BETWEEN ('" + TSini + "') AND ('" + TSfin + "') AND Usuario = '"+ TSuser +"';", function (err, rows) {
    if (err) throw err;
    var HistData = JSON.parse(JSON.stringify(rows))
    var DataHist = Object.values(HistData)
    var ConverArray = []
    var CoordinatesArrTemp = []
    var CoordinatesArr = []
    var UserData = []
    var timearrtemp = []
    var timearr = []
    
    //console.log(DataHist)
    for (var i = 0; i < DataHist.length; i++) {
      ConverArray.push(Object.values(DataHist[i]))
    }
    //console.log(ConverArray)
    for (var j = 0; j < DataHist.length; j++) {
      UserData.push(ConverArray[j][1]);
      CoordinatesArrTemp = [ConverArray[j][2], ConverArray[j][3]];
      CoordinatesArr.push(CoordinatesArrTemp);
      timearrtemp = [ConverArray[j][4]];
      timearr.push(timearrtemp);
    }

    var DataTimeStamp = CoordinatesArr;
    var DatoTiempo = timearr;
    var DataUsuario = UserData;
    io.emit('timestamp', {
      DataUsuario: DataUsuario,
      DataTimeStamp: DataTimeStamp,
      DatoTiempo : DatoTiempo
    });

  });
  res.json({
    status: 'received'
  });
  res.end("");

});

var loop;

app.post('/multihistoric', function (req, res) {
  console.log("MultiHistorics sending")
  console.log(req.body);
  var HisDat = req.body;
  var TSini = HisDat.datainicio.toString();
  var TSfin = HisDat.datafin.toString();
  var Dataobj= new Array();

  for (i=0; i < HisDat.multi_datauser.length;i++){
    loop=i;
    var TSuser= HisDat.multi_datauser[i].toString();
    //console.log(TSini, TSfin, TSuser);

    con.query("SELECT * FROM gps WHERE TimeStamp BETWEEN ('" + TSini + "') AND ('" + TSfin + "') AND Usuario = '"+ TSuser +"';", function(err, rows){
      if (err) throw err;
      var Datavector=new Array();
      var HistData = JSON.parse(JSON.stringify(rows))
      var DataHist = Object.values(HistData)
      var ConverArray = []
      var CoordinatesArrTemp = []
      var CoordinatesArr = []
      var UserData = []
      var timearrtemp = []
      var timearr = []
      
      //console.log(DataHist)
      for (var i = 0; i < DataHist.length; i++) {
        ConverArray.push(Object.values(DataHist[i]))
      }
      //console.log(ConverArray)
      for (var j = 0; j < DataHist.length; j++) {
        UserData.push(ConverArray[j][1]);
        CoordinatesArrTemp = [ConverArray[j][2], ConverArray[j][3]];
        CoordinatesArr.push(CoordinatesArrTemp);
        timearrtemp = [ConverArray[j][4]];
        timearr.push(timearrtemp);
      }

      var DataTimeStamp = CoordinatesArr;
      var DatoTiempo = timearr;
      var DataUsuario = UserData;

      Dataobj.push(new Object({
        DataUsuario: DataUsuario,
        DataTimeStamp:DataTimeStamp,
        DatoTiempo : DatoTiempo
      }))

      io.emit('multitimestamp', {
        Dataobj: Dataobj
      });



    });           
      
  }

  res.json({
    status: 'received'
  });
  res.end("");

});