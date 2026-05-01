import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Phone, MapPin, X, AlertCircle } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { computeSoldeForClient } from '../../../lib/credit';
import { callPhone, navigateTo } from '../../../lib/linking';
import { formatFCFA } from '../../../lib/format';
import type { ClientResponse } from '../../../types/api';

interface ClientPin {
  id: string;
  name: string;
  address: string;
  contact: string;
  lat: number;
  lng: number;
  /** 'debt' = doit / 'credit' = crédit / 'ok' = à jour */
  color: 'debt' | 'credit' | 'ok';
  solde: number;
}

function parseLatLng(s: string | null | undefined): { lat: number; lng: number } | null {
  if (!s) return null;
  const [a, b] = s.split(',').map((p) => parseFloat(p.trim()));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return null;
}

/**
 * Carte de tous les clients géolocalisés du livreur.
 *
 * Affiche un pin par client avec position GPS, popup avec infos de
 * base, et tap → bottom sheet avec actions (Appeler / Y aller / Voir
 * détail). Pin coloré selon le solde :
 *   - rouge : client en dette (solde > 0)
 *   - vert  : client en crédit (solde < 0)
 *   - bleu  : client à jour (solde = 0)
 *
 * Source de données : `useClientsByLivreur` + `useLivraisonsByLivreur` +
 * `useEncaissementsByLivreur`. Le solde est calculé front-side via
 * `computeSoldeForClient` (mirror du web).
 *
 * Carte : Leaflet via WebView (satellite Esri + labels overlay) — même
 * stack que `MapPreview` mais étendu avec multi-markers + autofit
 * bounds + popup HTML + postMessage pour le tap.
 */
export default function ClientsMap() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qC = useClientsByLivreur(livreurId);
  const qL = useLivraisonsByLivreur(livreurId);
  const qE = useEncaissementsByLivreur(livreurId);

  const [selected, setSelected] = useState<ClientPin | null>(null);

  const pins = useMemo<ClientPin[]>(() => {
    const livraisons = qL.data ?? [];
    const encaissements = qE.data ?? [];
    return (qC.data ?? [])
      .map((c: ClientResponse) => {
        const geo = parseLatLng(c.latitudeLongitude);
        if (!geo) return null;
        const solde = computeSoldeForClient(livraisons, encaissements, c.id);
        const color: ClientPin['color'] =
          solde > 0 ? 'debt' : solde < 0 ? 'credit' : 'ok';
        return {
          id: c.id,
          name: `${c.prenom} ${c.nom}`.trim(),
          address: c.adresse?.trim() || c.quartier?.libelle || '',
          contact: c.contact ?? '',
          lat: geo.lat,
          lng: geo.lng,
          color,
          solde,
        };
      })
      .filter((p): p is ClientPin => p !== null);
  }, [qC.data, qL.data, qE.data]);

  const totalClients = qC.data?.length ?? 0;
  const sansGeo = totalClients - pins.length;
  const enDette = pins.filter((p) => p.color === 'debt').length;
  const enCredit = pins.filter((p) => p.color === 'credit').length;

  const html = useMemo(() => buildHtml(pins), [pins]);

  if (qC.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  if (pins.length === 0) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Carte des clients" subtitle={`${totalClients} clients au total`} />
        <View className="flex-1 px-4 pt-4">
          <EmptyState
            title="Aucune position GPS"
            message={
              totalClients === 0
                ? "Tu n'as pas encore de client."
                : "Aucun de tes clients n'a de coordonnées GPS enregistrées. Capture leur position depuis la fiche client (bouton Modifier)."
            }
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Carte des clients"
        subtitle={`${pins.length} géolocalisés${sansGeo > 0 ? ` · ${sansGeo} sans GPS` : ''}`}
      />

      {/* Légende compacte au-dessus de la carte */}
      <View className="px-4 pt-2 pb-3 flex-row gap-2">
        <Legend color="#dc2626" label={`${enDette} en dette`} />
        <Legend color="#10b981" label={`${enCredit} en crédit`} />
        <Legend color="#3b82f6" label={`${pins.length - enDette - enCredit} à jour`} />
      </View>

      {/* Carte plein écran */}
      <View className="flex-1 mx-4 mb-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={{ flex: 1, backgroundColor: '#0f172a' }}
          scrollEnabled={false}
          bounces={false}
          scalesPageToFit
          onMessage={(event) => {
            try {
              const msg = JSON.parse(event.nativeEvent.data);
              if (msg.type === 'CLIENT_TAP') {
                const pin = pins.find((p) => p.id === msg.id);
                if (pin) setSelected(pin);
              }
            } catch {
              /* ignore — message non-JSON */
            }
          }}
          onShouldStartLoadWithRequest={(req) =>
            req.url.startsWith('about:') ||
            req.url.startsWith('data:') ||
            req.url.startsWith('https://')
          }
        />
      </View>

      {/* Bottom sheet — affiché quand un pin est tapé */}
      {selected ? (
        <ClientBottomSheet
          pin={selected}
          onClose={() => setSelected(null)}
          onCall={() => {
            if (selected.contact) callPhone(selected.contact);
          }}
          onNavigate={() => {
            navigateTo(selected.lat, selected.lng, selected.name);
          }}
          onOpenDetail={() => {
            const id = selected.id;
            setSelected(null);
            router.push({
              pathname: '/(livreur)/clients/[id]' as never,
              params: { id },
            } as never);
          }}
        />
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1">
      <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
        {label}
      </Text>
    </View>
  );
}

function ClientBottomSheet({
  pin,
  onClose,
  onCall,
  onNavigate,
  onOpenDetail,
}: {
  pin: ClientPin;
  onClose: () => void;
  onCall: () => void;
  onNavigate: () => void;
  onOpenDetail: () => void;
}) {
  const dotColor =
    pin.color === 'debt' ? '#dc2626' : pin.color === 'credit' ? '#10b981' : '#3b82f6';
  return (
    <View className="absolute bottom-4 left-4 right-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-lg">
      <View className="flex-row items-start gap-2">
        <View
          className="w-2.5 h-2.5 rounded-full mt-2"
          style={{ backgroundColor: dotColor }}
        />
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white text-base">
            {pin.name}
          </Text>
          {pin.address ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {pin.address}
            </Text>
          ) : null}
          {pin.solde !== 0 ? (
            <Text
              className={`text-[12px] font-bold mt-1 ${
                pin.color === 'debt'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {pin.color === 'debt' ? '⚠ Doit ' : '+ Crédit '}
              {formatFCFA(Math.abs(pin.solde))} F
            </Text>
          ) : (
            <Text className="text-[12px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">
              ✓ À jour
            </Text>
          )}
        </View>
        <Pressable onPress={onClose} hitSlop={10} className="active:opacity-60 p-1">
          <X color="#94a3b8" size={18} />
        </Pressable>
      </View>

      <View className="flex-row gap-2 mt-3">
        <Pressable
          onPress={onCall}
          disabled={!pin.contact}
          className={`flex-1 flex-col items-center gap-1 py-2.5 rounded-md border ${
            pin.contact
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 active:opacity-70'
              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-40'
          }`}
        >
          <Phone color="#10b981" size={16} />
          <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            Appeler
          </Text>
        </Pressable>
        <Pressable
          onPress={onNavigate}
          className="flex-1 flex-col items-center gap-1 py-2.5 rounded-md border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 active:opacity-70"
        >
          <MapPin color="#3b82f6" size={16} />
          <Text className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
            Y aller
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenDetail}
          className="flex-1 flex-col items-center gap-1 py-2.5 rounded-md bg-emerald-500 active:opacity-80"
        >
          <AlertCircle color="#fff" size={16} />
          <Text className="text-[11px] font-bold text-white">Détail</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Génère le HTML Leaflet avec tous les pins. Auto-fit bounds. Chaque
 * marker poste un message au RN au tap pour qu'on ouvre la bottom sheet.
 */
function buildHtml(pins: ClientPin[]): string {
  // Couleurs des pins selon le solde — gradient + bordure blanche pour
  // un look moderne. Inline dans le JS du WebView.
  const COLOR_DEBT = '#ef4444'; // rouge — doit
  const COLOR_CREDIT = '#10b981'; // vert — crédit
  const COLOR_OK = '#3b82f6'; // bleu — à jour

  // Centre par défaut si pas de pin (Plateau, Abidjan)
  const defaultCenter = { lat: 5.345, lng: -4.024 };

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
    .pin {
      width: 30px; height: 30px;
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
      width: 8px; height: 8px;
      background: #fff;
      border-radius: 50%;
    }
    .pin-debt   { background: linear-gradient(180deg, ${COLOR_DEBT}, #b91c1c); }
    .pin-credit { background: linear-gradient(180deg, ${COLOR_CREDIT}, #047857); }
    .pin-ok     { background: linear-gradient(180deg, ${COLOR_OK}, #1e40af); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var pins = ${JSON.stringify(pins)};

    var satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles © Esri' }
    );
    var labels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, opacity: 0.9 }
    );
    var plan = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
      attribution: '© OpenStreetMap · © CARTO'
    });

    var map = L.map('map', {
      center: [${defaultCenter.lat}, ${defaultCenter.lng}],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      tap: true,
      tapTolerance: 15,
      layers: [satellite, labels]
    });

    L.control.layers(
      { 'Satellite': satellite, 'Plan': plan },
      { 'Étiquettes': labels },
      { position: 'topright', collapsed: true }
    ).addTo(map);

    var bounds = L.latLngBounds([]);

    pins.forEach(function(p) {
      var iconClass = p.color === 'debt' ? 'pin-debt' : p.color === 'credit' ? 'pin-credit' : 'pin-ok';
      var icon = L.divIcon({
        className: '',
        html: '<div class="pin ' + iconClass + '"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });
      var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
      marker.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CLIENT_TAP',
            id: p.id
          }));
        }
      });
      bounds.extend([p.lat, p.lng]);
    });

    if (pins.length > 0) {
      // Ajustement aux bornes — petit padding pour ne pas coller aux bords
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }

    document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
  </script>
</body>
</html>`;
}
