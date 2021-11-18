//Inicialización de Variables Globales y definición de librerías importantes.
const express = require('express');
var app = require('express')();
var server = require('http').createServer(app);
var systemchild = require("child_process");
const port = 3000;
var DatosGPS;
var udp = require('dgram');
var dir = __dirname;
var io = require('socket.io')(server);
io.setMaxListeners(0);

//Método post, para ejecutar automáticamente un "-git pull" cuando se detecta un "PUSH" en el repositorio remoto.
app.post('/github', function (req, res) {  
  systemchild.exec("cd /home/ubuntu/LocateCabs && git reset --hard && git pull");
  console.log("GIT PULL realizado exitosamente.");
  res.end("");
});


//Definición de rutas o URL's del servidor web y de algunos archivos necesarios.
app.get('/', function (req, res) {
  res.sendFile(dir + '/index.html');
});
app.get('/idxstyle.css', function (req, res) {
  res.sendFile(dir + '/idxstyle.css');
});
app.get('/histstyle.css', function (req, res) {
  res.sendFile(dir + '/histstyle.css');
});
app.get('/logo.svg', function (req, res) {
  res.sendFile(dir + '/logo.svg');
});
app.get('/favicon.ico', function (req, res) {
  res.sendFile(dir + '/favicon.ico');
});
app.get('/bg.png', function (req, res) {
  res.sendFile(dir + '/bg.png');
});
app.get('/github.svg', function (req, res) {
  res.sendFile(dir + '/github.svg');
});
app.get('/historicos', function (req, res) {
  res.sendFile(dir + '/historicos.html');
});
app.get('/times.svg', function (req, res) {
  res.sendFile(dir + '/times.svg');
});
app.get('/gps.svg', function (req, res) {
  res.sendFile(dir + '/gps.svg');
});
app.get('/download.svg', function (req, res) {
  res.sendFile(dir + '/download.svg');
});
app.get('/heart.svg', function (req, res) {
  res.sendFile(dir + '/heart.svg');
});
app.get('/historico.svg', function (req, res) {
  res.sendFile(dir + '/historico.svg');
});
app.get('/app-release.apk', function (req, res) {
  res.sendFile(dir + '/app-release.apk');
});
app.get('/cursor.png', function (req, res) {
  res.sendFile(dir + '/cursor.png');
});

//Conexión al puerto del servidor web basado en Javascript.
server.listen(port, function (error) {
  if (error) {
    console.log('Error: El servidor web no se pudo iniciar en el puerto establecido (' + port +') ' + error);
  } else {
    console.log('El servidor web se inició correctamente en el puerto ' + port + '.');
  }
})


//Definición de las variables de entorno.
dotenv = require('dotenv');
const entvar = dotenv.config();

if (entvar.error) {
  throw entvar.error;
}

//Llamado de las variables de entorno y de librería MySQL para la Base de datos.
const mysql = require('mysql');
var con = mysql.createConnection({
  host: entvar.parsed.DB_HOST,
  user: entvar.parsed.DB_USER,
  password: entvar.parsed.DB_PASS,
  database: 'locatecabs'
});

//Intento de conexión con la base de datos.
con.connect((err) => {
  if (err) {
    console.log('Hay un error de conexión con la base de datos')
  } else {
    console.log('La conexión con la base de datos funciona.')
    console.log(entvar.parsed); //Muestra las variables de entorno de la base de datos.
  }
})

//Ingresa valores no nulos inicialmente en la base de datos por defecto para evitar futuros errores.
var Imysql = "INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp, RPM) VALUES ?";
var values = [
  ["-", "-", "-", "-", "-"],
];
con.query(Imysql, [values], function (err) {
  if (err) throw err;
});

//Consulta a la base de datos por primera vez y manda el vector de usuarios para la lista desplegable----
let Usersvec;
con.query('SELECT DISTINCT Usuario FROM gps ORDER BY Usuario', function(err, users){
  if (err) throw err;
  Usersvec = users.map(e=> e.Usuario);
  console.log('Los usuarios encontrados por primera vez en la base de datos son:'); 
  console.log(Usersvec);

  io.on('connection', function (socket) {
    socket.emit('init_users', {
      Usersvec: Usersvec
    });
  });
});


//Creación del socket UDP para el servidor.
var serverudp = udp.createSocket('udp4');
serverudp.on('error', function (error) {
  console.log('Error: ' + error);
  serverudp.close();
});

//Establece el Puerto UDP 3020 como base de recepción de los datos externos enviados desde Android.
serverudp.bind(3020);

//Definición del vector de objetos temporales, de usuarios analizados y de la función de "Tiempo de vida", para el posterior rastreo de múltiples vehículos.
var objTemp= new Array();
var DataAnalized= new Array();
var contador=0;
const lifetime=10;  //Tiempo de vida o duración máxima, en segundos, del marcador de un vehículo en el mapa, si es que éste pierde la conexión o deja de enviar datos en ese rango de tiempo.

setInterval(function(){

  if (contador!=lifetime){
    contador+=1;
    console.log('Remaining Lifetime (seconds) = '+ (lifetime+1-contador));
  } else{
    updateData();
    contador=0;
    console.log('Lifetime was reset.' + '\n');
  }
  
},1000);

//Función para actualizar el vector de datos de usuarios o ID's de vehículos que van a ser analizados por la base de datos.
function updateData(){ 
  DataAnalized=[];
  for (var i=0; i<objTemp.length; i++){
    if(objTemp[i].extend_time==1){
      DataAnalized.push(objTemp[i].id);
      objTemp[i].extend_time=0;
    }
  }
}

//Función para buscar el atributo "ID" dentro de un array.
function containsID(array, attribute){ 

  var found = false;
  for(var i = 0; i < array.length; i++) {
      if (array[i].id == attribute) {
          found = true;
          var pos=i;
          break;
      }
  }
  
  return [pos,found];

}


//Uso del evento "message" para comenzar a recibir los mensajes UDP desde el backend del web server.
serverudp.on('message', function (msg, info) {
  console.log('Data received from client: ' + msg.toString());
  console.log('Received %d bytes from %s:%d', msg.length, info.address, info.port);

  //(Verificación de mensaje) Intenta enviar el mensaje recibido localmente, con el mismo valor de puerto capturado de la dirección que envió el mensaje.
  serverudp.send(msg, info.port, 'localhost', function (error) {
    if (error) {
      console.log('Error: ' + error);
      serverudp.close();    
    } else {
      console.log('Data sent !!!');
    }
  });

  //Inserta los datos enviados al socket UDP hacia la base de datos, insertando una nueva fila.
  DatosGPS = msg.toString().split(";")
  var Imysql = "INSERT INTO gps (Usuario, Latitud, Longitud, TimeStamp, RPM) VALUES ?";
  //var RPM_vec=[0, 100, 200.1, 300, 300.530, 400, 500, 600, 700.72, 800, 900, 1000.059, 1100.2, 1200, 1300.4, 1400, 1500.02, 1600, 1700, 1800, 1900, 2000];
  //var RPM_test=RPM_vec[Math.floor(Math.random() * 22)].toString();
  var values = [
    [DatosGPS[0], DatosGPS[1], DatosGPS[2], DatosGPS[3], DatosGPS[4]]];
  con.query(Imysql, [values], function (err, result) {
    if (err) throw err;
    console.log("Records inserted: " + result.affectedRows);

    //Busca el usuario en el vector de usuarios analizados temporalmente. Si no se encuentra, crea un nuevo objeto para el usuario. En caso contrario, prolonga el tiempo de vida.
    [pos, found]=containsID(objTemp, DatosGPS[0]);
    if (!found){
      objTemp.push(new Object({
        id: DatosGPS[0],
        extend_time: 1
      }));
    } else{
      objTemp[pos].extend_time=1;
    }

    //Busca el usuario en el vector de usuarios analizados a tiempo REAL. Si no se encuentra, lo agrega.
    if (!DataAnalized.includes(DatosGPS[0])){
      DataAnalized.push(DatosGPS[0]);
    }

  });

  
  //Consulta nuevamente el vector de usuarios en la base de datos
  con.query('SELECT DISTINCT Usuario FROM gps ORDER BY Usuario', function(err, users){

    if (err) throw err;
    Usersvec = users.map(e=> e.Usuario);

  });

  //Si no se encuentra el usuario que envió mensaje en la base de datos, le avisa al Frontend que se detectó un nuevo usuario.
  if (!Usersvec.includes(DatosGPS[0])){
    io.emit('new_user_detected', {
      Newuser: DatosGPS[0]
    });
  }

});

//Detecta si se cerró el socket UDP del servidor e imprime mensaje en consola.
serverudp.on('close', function () {
  console.log('Se detuvo el socket UDP!');
});

//Consulta a la base de datos y conexión constante Backend-Frontend para los vehículos analizados en el vector "DataAnalized".
var GPSobj= new Array();

setInterval(function() { 
  if (DataAnalized.length!=0){
    console.log('Vector de usuarios analizados= '+ DataAnalized + '\n');
    const usuarios_analizados= DataAnalized.length;
    io.emit('connectedusers', {
      Cantidad: usuarios_analizados
    })

    GPSobj=[];

    for(var i=0; i<DataAnalized.length; i++){
      con.query("SELECT * FROM gps WHERE Usuario = '"+ DataAnalized[i] +"' ORDER BY idGPS DESC LIMIT 1", function(err, rows){
        if (err) throw err;
        var data = JSON.parse(JSON.stringify(rows));
        var dataGPS = Object.values(data[0]);
        var DataUsu = dataGPS[1];
        var DataLat = parseFloat(dataGPS[2]).toFixed(6);
        var DataLong = parseFloat(dataGPS[3]).toFixed(6);
        var DataTime = parseFloat(dataGPS[4]);
        var DataRPM = parseFloat(dataGPS[5]);

        GPSobj.push(new Object({
          DataUsu: DataUsu,
          DataLat: DataLat,
          DataLong: DataLong,
          DataTime: DataTime,
          DataRPM: DataRPM
        }));

        io.emit('change', {
          GPSobj: GPSobj
        })

      });
    }
  } else{
    io.emit('nousersconnected');
  }
}, 1000)

//Definición del límite de datos recibidos desde el backend para la parte de históricos.
app.use(express.json({limit: '200mb'}));


//Consulta el histórico de un solo usuario en la base de datos y lo reenvía al Frontend.
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
    var RPMData = []
    
    //console.log(DataHist)
    for (var i = 0; i < DataHist.length; i++) {
      ConverArray.push(Object.values(DataHist[i]))
    }
    //console.log(ConverArray)
    for (var j = 0; j < DataHist.length; j++) {
      RPMData.push(ConverArray[j][5]);
      UserData.push(ConverArray[j][1]);
      CoordinatesArrTemp = [ConverArray[j][2], ConverArray[j][3]];
      CoordinatesArr.push(CoordinatesArrTemp);
      timearrtemp = [ConverArray[j][4]];
      timearr.push(timearrtemp);
    }

    var DataTimeStamp = CoordinatesArr;
    var DatoTiempo = timearr;
    var DataUsuario = UserData;
    var DataRPM = RPMData;

    io.emit('timestamp', {
      DataUsuario: DataUsuario,
      DataTimeStamp: DataTimeStamp,
      DatoTiempo : DatoTiempo,
      DataRPM: DataRPM
    });

  });
  res.json({
    status: 'received'
  });
  res.end("");

});


//Consulta el histórico de múltiples usuarios y lo reenvía al Frontend como vector de objetos.
app.post('/multihistoric', function (req, res) {
  console.log("MultiHistorics sending")
  console.log(req.body);
  var HisDat = req.body;
  var TSini = HisDat.datainicio.toString();
  var TSfin = HisDat.datafin.toString();
  var Dataobj= new Array();

  for (i=0; i < HisDat.multi_datauser.length;i++){
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
      var RPMData = []

      //console.log(DataHist)
      for (var i = 0; i < DataHist.length; i++) {
        ConverArray.push(Object.values(DataHist[i]))
      }
      //console.log(ConverArray)
      for (var j = 0; j < DataHist.length; j++) {
        RPMData.push(ConverArray[j][5]);
        UserData.push(ConverArray[j][1]);
        CoordinatesArrTemp = [ConverArray[j][2], ConverArray[j][3]];
        CoordinatesArr.push(CoordinatesArrTemp);
        timearrtemp = [ConverArray[j][4]];
        timearr.push(timearrtemp);
      }

      var DataTimeStamp = CoordinatesArr;
      var DatoTiempo = timearr;
      var DataUsuario = UserData;
      var DataRPM = RPMData;

      Dataobj.push(new Object({
        DataUsuario: DataUsuario,
        DataTimeStamp:DataTimeStamp,
        DatoTiempo: DatoTiempo,
        DataRPM: DataRPM
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