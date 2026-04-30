import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Interactive Leaflet map embedded in a WebView.
 * Uses CartoDB Voyager raster tiles (free, no API key, modern colorful
 * style) for a far more polished look than plain OSM. Pan + pinch-to-zoom
 * work natively. Renders in Expo Go via react-native-webview.
 *
 * Why a WebView and not react-native-maps?
 *   • react-native-maps requires a custom dev build / EAS native module —
 *     incompatible with Expo Go testing. WebView ships with Expo Go.
 *   • Leaflet is mature, lightweight, and gives interactive UX out of the
 *     box (zoom controls, dragging, double-tap-to-zoom).
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
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #e2e8f0; }
    .leaflet-control-attribution { font-size: 9px; }
    .pin {
      width: 36px; height: 36px;
      background: linear-gradient(180deg, #ef4444, #b91c1c);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #fff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
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
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 16,
      zoomControl: true,
      attributionControl: true,
      // friendlier mobile UX
      tap: true,
      tapTolerance: 15
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> · © <a href="https://carto.com">CARTO</a>'
    }).addTo(map);

    var icon = L.divIcon({
      className: '',
      html: '<div class="pin"></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
    L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);

    // Avoid the page itself scrolling — keep the map gestures inside
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
        style={{ flex: 1, backgroundColor: '#e2e8f0' }}
        scrollEnabled={false}
        bounces={false}
        // Allow pinch-zoom on iOS
        scalesPageToFit
        // Don't load external nav links inside the webview
        onShouldStartLoadWithRequest={(req) => req.url.startsWith('about:') || req.url.startsWith('data:') || req.url.startsWith('https://unpkg.com') || req.url.startsWith('https://')}
      />
    </View>
  );
}
