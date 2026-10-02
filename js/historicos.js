//Declaración de Variables Globales
let lat = 10.984719;
let long = -74.811302;
var polylinePoints;
var polyline;
var datainicio;
var datafin;
var polylineHistoric;
var polyline_set = 0;
var startpoint;
var startpointHist;
var finalpointHist;
var currentpointHist;
var startpoint_was_set = 0;
var hist_was_set = 0;
let latlngs = [];
let latlngsTemp = [];
let Coordinates = [];
let CCoordinates = [];


var greenIcon = new L.Icon({
iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-green.png',
shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
iconSize: [25, 41],
iconAnchor: [12, 41],
popupAnchor: [1, -34],
shadowSize: [41, 41]
});




//Condición de Calendario
window.addEventListener('load', function () {
  datainicio = document.getElementById('IHist')
  datainicio.addEventListener('change', function () { 
    if (document.getElementById('FHist').value < this.value) { 
    document.getElementById('FHist').value = this.value;
    }

  });
  datafin = document.getElementById('FHist')
  datafin.addEventListener('change', function () {
    if (document.getElementById('IHist').value > this.value) {
      this.value = document.getElementById('IHist').value;
    }
  });

});

//Función de consulta de histórico o
function changehist() {
  valor = document.getElementById('switch2').checked;
  if (valor) {
    enviarhist().then(function () {
      if (Coordinates.length != 0) {
        if (hist_was_set == 1) {
          polylineHistoric.setLatLngs(Coordinates);
          startpointHist.setLatLng(Coordinates[0]);
          finalpointHist.setLatLng(Coordinates[Coordinates.length - 1]);
          mymap.fitBounds(Coordinates);
        } else {
          startPolyline2();
          startpointHist = L.marker(Coordinates[0]).addTo(mymap);
          finalpointHist = L.circleMarker(Coordinates[Coordinates.length - 1], { color: '#FFB242' }).addTo(mymap);
        }
      } else {
        console.log('El intervalo de tiempo o Usuario ingresado no es válido.');
      }
    });
  }
}
//Función de coneión Frontend-Backend del histórico
async function enviarhist() {
  datainicio = document.getElementById('IHist').value;
  datafin = document.getElementById('FHist').value;
  datainicio = new Date(datainicio).valueOf();
  datafin = new Date(datafin).valueOf();
  datainicio = datainicio.toString();
  datafin = datafin.toString();
  console.log('datainicio= ' + datainicio);
  console.log('datafina= ' + datafin);
  const info = { datainicio, datafin };
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(info)
  };
  // The server answers with the points for this browser only (it used to broadcast them).
  const response = await fetch('/historic', options);
  Coordinates = response.ok ? (await response.json()).points : [];
}


//Función de consulta de histórico actual
function changehistact() {
  valor = document.getElementById('switch3').checked;
  if (valor) {
    enviarhistact();
  }
}
//Función de coneión Frontend-Backend del histórico actual
async function enviarhistact() {
  dataactual = document.getElementById('CHist').value;
  dataactual = new Date(dataactual).valueOf();
  dataactual = dataactual.toString();
  console.log('dataactual= ' + dataactual);
  const info = { dataactual };
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(info)
  };
  const response = await fetch('/historicact', options);
  CCoordinates = response.ok ? (await response.json()).point : null;
}


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
function startPolyline2() {
  if (Coordinates.length != 0) {
    polylineHistoric = L.polyline(Coordinates, { color: 'red' }).addTo(mymap);
    mymap.fitBounds(Coordinates);
    hist_was_set = 1;
  } else {
    console.log('El intervalo de tiempo o Usuario ingresado no es válido.');
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
function clearpoly2() {
  polylineHistoric.removeFrom(mymap)
  hist_was_set = 0;
}
let mymap = L.map('mapid').setView([lat, long], 18);
var circle = L.circle([lat, long], { radius: 50, color: '#FCFF42' }).addTo(mymap);
var circle_marker = L.circleMarker([lat, long], { color: '#CA2049' }).bindPopup("No Data", { autoPan: false }).addTo(mymap);
circle_marker.openPopup();
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(mymap);
//Funciones de los switches al trazar histórico
function condicional2() {
  if (document.getElementById('switch2').disabled != true) {
    valor = document.getElementById('switch2').checked;
    if (valor) {
      if (hist_was_set == 1) {
        clearpoly2();
        startpointHist.removeFrom(mymap);
        finalpointHist.removeFrom(mymap);
      }
      setMarker();
      circle_marker.setRadius(10);
      circle.setRadius(50);
      circle_marker.openPopup();
      document.getElementById('switch3').disabled = false;
    } else {
      document.getElementById('switch3').disabled = true;
      enviarhist().then(function () {
        startPolyline2();
        circle_marker.setRadius(0);
        circle.setRadius(0);
        if (Coordinates.length != 0) {
          startpointHist = L.marker(Coordinates[0], {icon: greenIcon }).addTo(mymap);
          finalpointHist = L.marker(Coordinates[Coordinates.length - 1]).addTo(mymap);
          finalpointHist.bindPopup("Fin", { autoPan: false }).openPopup()
          startpointHist.bindPopup("Inicio", { autoPan: false }).openPopup()
          polylineHistoric.on('click',(e)=>{
            let info = "Ubicación: " + e.latlng.toString();
            L.popup().setLatLng(e.latlng).setContent(textPopup(info)).openOn(mymap);
          })
        }
      });
    }
  }
}
function condicional3() {
  if (document.getElementById('switch3').disabled != true) {
    valor = document.getElementById('switch3').checked;
    if (valor) {
      if (hist_was_set == 1) {
        clearpoly2();
        startpointHist.removeFrom(mymap);
        finalpointHist.removeFrom(mymap);
      }
      setMarker();
      circle_marker.setRadius(10);
      circle.setRadius(50);
      circle_marker.openPopup();
      if (currentpointHist) {
        currentpointHist.removeFrom(mymap);
        currentpointHist = null;
      }
      document.getElementById('switch2').disabled = false;
    } else {
      document.getElementById('switch2').disabled = true;
      enviarhistact().then(function () {
        if (CCoordinates) {
          currentpointHist = L.marker(CCoordinates).addTo(mymap);
          mymap.setView(new L.LatLng(CCoordinates[0], CCoordinates[1]), 18);  //Centra hacia la posición actual consulta.
        } 
        circle_marker.closePopup();
        circle_marker.setRadius(0);
        circle.setRadius(0);
      });
    }
  }
}
// Event handlers (formerly inline on* attributes, which the Content-Security-Policy blocks)
document.getElementById('IHist').addEventListener('change', changehist);
document.getElementById('FHist').addEventListener('change', changehist);
document.getElementById('CHist').addEventListener('change', changehistact);
document.querySelector('label[for="switch2"]').addEventListener('click', condicional2);
document.querySelector('label[for="switch3"]').addEventListener('click', condicional3);
