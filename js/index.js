//Declaración de Variables Globales
let lat = 10.984719;
let long = -74.811302;
var polylinePoints;
var polyline;
var polyline_set = 0;
var startpoint;
var startpoint_was_set = 0;
let latlngs = [];
let latlngsTemp = [];
// Popup content as a text node: a taxi id is shown as text, never parsed as HTML.
function textPopup(text) {
  var span = document.createElement('span');
  span.textContent = text == null ? '-' : String(text);
  return span;
}
//Serie de funciones para el mapa
function MapsetUbication() {
  mymap.setView(new L.LatLng(lat, long));
}
function MapAutoCenter() {
  if (document.getElementById('switch').checked) {
    if (startpoint_was_set == 1) {
      mymap.fitBounds(polyline.getBounds()); //Centra hacia la polilínea.
    }
  } else {
    mymap.setView(new L.LatLng(lat, long), 18);  //Centra hacia la posición actual.
  }
}
function setMarker() {
  if (lat != null && isNaN(lat) == false && long != null && isNaN(long) == false) {
    circle_marker.setLatLng(new L.LatLng(lat, long));
    circle.setLatLng(new L.LatLng(lat, long));
  }
}
function Markerlabel() {
  circle_marker.bindPopup(textPopup(usuario), { autoPan: false }).openPopup()
}
function createStartPoint() {
  startpoint = L.marker([lat, long]).addTo(mymap);
}
function startPolyline() {
  if (isNaN(latlngs) == false) {
    polyline = L.polyline(latlngs).addTo(mymap);
    polyline_set = 1;
  }
}
function addPolyline() {
  if ((polyline_set == 1)) {
    polyline.setLatLngs(latlngs)
    if (!polyline.isEmpty() && polyline.getLatLngs().length == 1 && startpoint_was_set == 0) {
      setTimeout(createStartPoint(), 1000)
      startpoint_was_set = 1;
    }
  }
}
function clearpoly() {
  if (polyline_set == 1) {
    polyline.removeFrom(mymap)
  }
}
let mymap = L.map('mapid').setView([lat, long], 18);
var circle = L.circle([lat, long], { radius: 50, color: '#FCFF42' }).addTo(mymap);
var circle_marker = L.circleMarker([lat, long], { color: '#CA2049' }).bindPopup("No Data", { autoPan: false }).addTo(mymap);
circle_marker.openPopup();
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(mymap);
//Recepción y traducción de información del Backend
document.addEventListener('DOMContentLoaded', function () {
  old_user = "-";
  io().on('change', function (data) {
    document.getElementById('UsuID').textContent = data.DataUsu;
    document.getElementById('LatID').textContent = data.DataLat;
    document.getElementById('LongID').textContent = data.DataLong;
    var date = new Date(parseFloat(data.DataTime));
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var month = months[date.getMonth()];
    var hours = date.toLocaleTimeString();
    var minutes = "0" + date.getMinutes();
    var seconds = "0" + date.getSeconds();
    var formattedTime = hours.substr(0, 2) + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
    var datofecha = date.getDate() + "/" + month + "/" + date.getFullYear();
    document.getElementById('FechaID').textContent = datofecha;
    document.getElementById('HoraID').textContent = formattedTime;
    lat = data.DataLat;
    long = data.DataLong;
    usuario = data.DataUsu;
    finallong = data.DataLong;
    finallat = data.DataLat;
    setInterval(setMarker, 1000);
    valor = document.getElementById('switch').checked;
    if (valor) {
      setInterval(latlngsTemp = [lat, long], 1000);
      setInterval(latlngs.push(latlngsTemp), 1000);
    } else {
      latlngs = [];
    }
    if (old_user != usuario) {
      setTimeout(function () {
        MapsetUbication();
        Markerlabel();
        if (valor) {
          latlngs = [];
          if (startpoint_was_set == 1) {
            startpoint.removeFrom(mymap);
            startpoint_was_set = 0;
          }
          clearpoly();
          startPolyline();
        }
      }
        , 1000);
      old_user = usuario;
    }
  });
});
//Funciones de los switches al trazar linea en vivo
function condicional() {
    valor = document.getElementById('switch').checked;
    if (valor) {
      setTimeout(function () {
        clearpoly();
        circle.setRadius(50);
        circle_marker.openPopup();
        if (startpoint_was_set == 1) {
          startpoint.removeFrom(mymap);
          startpoint_was_set = 0;
        }
      }
        , 100)
    }
    else {
      console.log('latlngs=' + latlngs.length)
      setTimeout(function () {
        circle.setRadius(0);
        startPolyline();
      }
        , 1000);
      setInterval(function () {
        setMarker();
        addPolyline();
      }
        , 1000);
    }
}
// Event handlers (formerly inline on* attributes, which the Content-Security-Policy blocks)
document.querySelector('label[for="switch"]').addEventListener('click', condicional);
document.getElementById('autoCenter').addEventListener('click', function () {
  MapAutoCenter();
  Markerlabel();
});
