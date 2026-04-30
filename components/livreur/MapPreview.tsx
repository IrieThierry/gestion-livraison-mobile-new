import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Carte Leaflet embarquée dans une WebView.
 *
 * Le rendu par défaut est en **vue satellite** (Esri World Imagery, libre,
 * pas de clé API requise) car en Côte d'Ivoire — et particulièrement dans
 * les zones informelles d'Abidjan — les bâtiments et toits sont des repères
 * bien plus exploitables qu'un plan abstrait.
 *
 * Un overlay semi-transparent ajoute par-dessus la couche satellite les
 * étiquettes de rues et de quartiers (Esri Reference / Boundaries) pour
 * rester navigable.
 *
 * Un toggle Plan / Satellite est intégré directement dans la carte
 * (contrôle natif Leaflet `L.control.layers`) afin que l'utilisateur
 * puisse basculer en un tap sans qu'on ait à exposer un état React.
 *
 * Pourquoi WebView et non react-native-maps ?
 *   • react-native-maps exige un build natif custom — incompatible avec
 *     Expo Go. La WebView ship d'office.
 *   • Leaflet est mature, gère le pinch/pan/zoom nativement et permet de
 *     superposer plusieurs couches (satellite + labels) gratuitement.
 */
export function MapPreview({
  lat,
  lng,
  height = 220,
}: {
  lat: number;
  lng: number;
  height?: number;
}) {
  const html = useMemo(
    () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #0f172a; }
    .leaflet-control-attribution { font-size: 9px; }
    .leaflet-control-layers { border-radius: 10px !important; }
    .leaflet-control-layers-toggle {
      width: 36px !important;
      height: 36px !important;
      background-size: 22px 22px !important;
    }
    .pin {
      width: 36px; height: 36px;
      background: linear-gradient(180deg, #ef4444, #b91c1c);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #fff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.45);
      position: relative;
    }
    .pin::after {
      content: '';
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(45deg);
      width: 10px; height: 10px;
      background: #fff;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    // ===== Couches de base =====
    // Vue satellite haute résolution Esri (libre d'usage, attribution requise)
    var satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      }
    );

    // Plan classique (CartoDB Voyager) pour les utilisateurs qui préfèrent
    var plan = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> · © <a href="https://carto.com">CARTO</a>'
    });

    // ===== Overlays =====
    // Étiquettes (rues, quartiers, communes) à superposer sur la satellite
    var labels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        opacity: 0.9,
        attribution: 'Labels © Esri'
      }
    );

    // ===== Carte =====
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 17,
      zoomControl: true,
      attributionControl: true,
      tap: true,
      tapTolerance: 15,
      // Démarre en vue satellite + labels par défaut
      layers: [satellite, labels]
    });

    L.control.layers(
      { 'Satellite': satellite, 'Plan': plan },
      { 'Étiquettes': labels },
      { position: 'topright', collapsed: true }
    ).addTo(map);

    // ===== Marker =====
    var icon = L.divIcon({
      className: '',
      html: '<div class="pin"></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
    L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);

    // Empêche le scroll de la page de capter les gestes — tout reste pour la carte
    document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
  </script>
</body>
</html>`,
    [lat, lng],
  );

  return (
    <View
      style={{
        height,
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
      }}
      className="border border-slate-200 dark:border-slate-700"
    >
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#0f172a' }}
        scrollEnabled={false}
        bounces={false}
        scalesPageToFit
        onShouldStartLoadWithRequest={(req) =>
          req.url.startsWith('about:') ||
          req.url.startsWith('data:') ||
          req.url.startsWith('https://unpkg.com') ||
          req.url.startsWith('https://server.arcgisonline.com') ||
          req.url.startsWith('https://') // les tuiles Esri/Carto sont en HTTPS
        }
      />
    </View>
  );
}
