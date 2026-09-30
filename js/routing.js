
let lat = 0;
let long = 0;
var polyline;
var control; //Routing Machine
var startpoint;
var startpoint_was_set=0;
let latlngs = [];
let latlngsTemp = [];

function MapsetUbication() { 
  mymap.setView(new L.LatLng(lat, long)); 
}

function MapAutoCenter() { 
  if (document.getElementById('switch').checked){
    mymap.fitBounds(polyline.getBounds()); //Centra hacia la polilínea.
  } else {
    mymap.setView(new L.LatLng(lat, long), 18);  //Centra hacia la posición actual.
  }   
}

function setMarker() {
  circle_marker.setLatLng(new L.LatLng(lat, long));
  circle.setLatLng(new L.LatLng(lat, long));
}

// Popup content as a text node: a taxi id is shown as text, never parsed as HTML.
function textPopup(text) {
  var span = document.createElement('span');
  span.textContent = text == null ? '-' : String(text);
  return span;
}

function Markerlabel() {
  circle_marker.bindPopup(textPopup(usuario), { autoPan: false }).openPopup()
}

function createStartPoint() { 
  vectorlat=polyline.getLatLngs();
  startpoint= L.marker([lat,long]).addTo(mymap);
}

function startPolyline() {
  polyline = L.polyline(latlngs).addTo(mymap);
}

function addPolyline() {
  polyline.setLatLngs(latlngs) 
  if (!polyline.isEmpty() && polyline.getLatLngs().length==1 && startpoint_was_set==0){
    setTimeout(createStartPoint(), 1000)
    startpoint_was_set=1;
  }    
  console.log(polyline.getLatLngs().length);
}

function clearpoly() {
  polyline.removeFrom(mymap)
}

//Routing Macine (OSRM - Open Source Routing Machine)

let latlngs_routing_extend = [];

function startRouteService(){
  control = L.Routing.control({
    router: L.Routing.mapbox('[INSERT_MAPBOX_TOKEN]', { profile: 'mapbox/walking' }),
    waypoints: latlngs_routing_extend,
    routeDragInterval: 3000,
    show: false,
    collapsible: false,
    fitSelectedRoutes: false,
    addWaypoints: false,
    draggableWaypoints: false,
    createMarker: function() { return null; }
  }).addTo(mymap);

  control._container.style.display = "None";

}

function addRouteService(){

  if (startpoint_was_set==1){

    if (latlngs_routing_extend.length==25){
      latlngs_routing_extend = [];
      control.addTo(mymap);
    } else {

      control.setWaypoints(latlngs_routing_extend);

    }
 
  }
}  
  


let mymap = L.map('mapid').setView([lat, long], 18);
var circle = L.circle([lat, long], { radius: 50, color: '#FCFF42' }).addTo(mymap);
var circle_marker = L.circleMarker([lat, long], { color: '#CA2049' }).bindPopup("No Data", { autoPan: false }).addTo(mymap);
circle_marker.openPopup();


L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=' + '[INSERT_MAPBOX_TOKEN]', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(mymap);



document.addEventListener('DOMContentLoaded', function () {
  old_user = "-";

  io().on('change', function (data) {

    document.getElementById('UsuID').textContent = data.DataUsu;
    document.getElementById('LatID').textContent = data.DataLat;
    document.getElementById('LongID').textContent = data.DataLong;
    document.getElementById('FechaID').textContent = data.DataFecha;
    document.getElementById('HoraID').textContent = data.DataHora;
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

      if (latlngs.length>=26){

        setTimeout(latlngs_routing_extend.push(latlngsTemp), 1000);
                
      } else {

        latlngs_routing_extend = latlngs;

      }


    } else {
      latlngs = [];
    }

    //Condicional para Routing Machine.
    

    if (old_user != usuario) {
      setTimeout(function () {
        MapsetUbication();
        Markerlabel();
        if (valor) {
          latlngs = [];
          latlngs_routing_extend = [];
          startpoint.removeFrom(mymap);
          startpoint_was_set=0;
          clearpoly();
          control.remove();
          startPolyline();
          startRouteService();
        }
      }
        , 1000);

      old_user = usuario;
    }


  });

});

function condicional() {

  valor = document.getElementById('switch').checked;

  if (valor) {
    setTimeout(function(){
      clearpoly();
      latlngs_routing_extend = [];
      control.remove();
      circle.setRadius(50);
      circle_marker.openPopup();
      startpoint.removeFrom(mymap);
      startpoint_was_set=0;
    }
      , 100)

  }

  else {

    setTimeout(function(){
      circle.setRadius(0);
      startPolyline();
      startRouteService();
    }
      , 1000);
    
    setInterval(function () {
      setMarker();
      addPolyline();
      addRouteService();
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
