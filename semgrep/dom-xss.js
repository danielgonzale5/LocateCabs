// Test cases for dom-xss.yaml (semgrep --test).

io().on('change', function (data) {
  // ruleid: innerhtml-with-dynamic-value
  document.getElementById('UsuID').innerHTML = data.DataUsu;
  // ok: innerhtml-with-dynamic-value
  document.getElementById('UsuID').textContent = data.DataUsu;
});

var html = '<table>';
html += '<tr><td>' + row.nombre + '</td></tr>';
// ruleid: innerhtml-with-dynamic-value
document.getElementById('table').innerHTML = html;

// ok: innerhtml-with-dynamic-value
document.getElementById('table').innerHTML = '';

// ruleid: leaflet-popup-with-dynamic-html
circle_marker.bindPopup(usuario, { autoPan: false }).openPopup();

// ok: leaflet-popup-with-dynamic-html
circle_marker.bindPopup(textPopup(usuario), { autoPan: false }).openPopup();

// ok: leaflet-popup-with-dynamic-html
finalpointHist.bindPopup('Fin', { autoPan: false });

let info = 'Ubicación: ' + e.latlng.toString();
// ruleid: leaflet-popup-with-dynamic-html
L.popup().setLatLng(e.latlng).setContent(info).openOn(mymap);
