import type { PersonneLocalisable } from '../../types/api';
import { lirePosition } from '../../lib/position';
import { jsonPourScript } from '../../lib/webview';
import { heure } from './etat';

/** Marqueur de la mini-carte : une personne et sa position partagée aujourd'hui. */
export interface PinPosition {
  id: string;
  nom: string;
  heure: string;
  lat: number;
  lng: number;
}

/** Positions du jour lisibles (sans état, position vide ou mal formée : pas de marqueur). */
export function positionsDuJour(personnes: readonly PersonneLocalisable[]): PinPosition[] {
  const pins: PinPosition[] = [];
  for (const p of personnes) {
    const point = lirePosition(p.etat?.position);
    if (!point) continue;
    pins.push({ id: p.id, nom: `${p.prenom} ${p.nom}`, heure: heure(p.etat?.partageeLe), ...point });
  }
  return pins;
}

/**
 * Mini-carte Leaflet (même pile que la carte des clients) : un marqueur rond à l'initiale par
 * position du jour ; un appui envoie `{ type: 'POSITION_TAP', id }` à l'application.
 * Les données passent par `jsonPourScript` (aucun `</script>` injectable).
 */
export function buildHtmlPositions(personnes: readonly PersonneLocalisable[]): string {
  const pins = positionsDuJour(personnes);
  // Centre par défaut si aucune position (Plateau, Abidjan)
  const centre = { lat: 5.345, lng: -4.024 };
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #0f172a; }
    .leaflet-control-attribution { font-size: 9px; }
    .rond {
      width: 30px; height: 30px; border-radius: 50%;
      background: #047857; border: 3px solid #fff; color: #fff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      font: bold 13px sans-serif;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var pins = ${jsonPourScript(pins)};
    var map = L.map('map', { center: [${centre.lat}, ${centre.lng}], zoom: 13, tap: true, tapTolerance: 15 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO'
    }).addTo(map);
    var bounds = L.latLngBounds([]);
    pins.forEach(function(p) {
      var rond = document.createElement('div');
      rond.className = 'rond';
      rond.textContent = (p.nom || '?').charAt(0).toUpperCase();
      var icon = L.divIcon({ className: '', html: rond.outerHTML, iconSize: [30, 30], iconAnchor: [15, 15] });
      var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
      marker.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POSITION_TAP', id: p.id }));
        }
      });
      bounds.extend([p.lat, p.lng]);
    });
    if (pins.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  </script>
</body>
</html>`;
}
