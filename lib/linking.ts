import { Linking } from 'react-native';
import { dialog } from './dialog';
import { lirePosition, urlGoogleMaps } from './position';

/**
 * Open the phone dialer prefilled with the given number.
 * Strips spaces; safe to pass any user-formatted phone string.
 */
export function callPhone(raw: string): void {
  const cleaned = raw.replace(/\s/g, '');
  if (!cleaned) return;
  Linking.openURL(`tel:${cleaned}`).catch(() => {
    /* user cancelled or no dialer */
  });
}

/**
 * Open turn-by-turn driving directions to the given coordinates.
 * Always uses Google Maps because Apple Maps' routing coverage in
 * West Africa (Côte d'Ivoire in particular) is incomplete — POIs
 * exist but the road network for routing returns 'Itinéraire non
 * disponible'.
 *
 * The https://www.google.com/maps/dir/?api=1 universal URL:
 *   • Opens the Google Maps app if installed (iOS + Android)
 *   • Falls back to the Google Maps web app in the default browser
 */
export function navigateTo(lat: number, lng: number, _label?: string): void {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;
  const url =
    `https://www.google.com/maps/dir/?api=1` +
    `&destination=${lat},${lng}` +
    `&travelmode=driving`;
  Linking.openURL(url).catch(() => {
    /* no browser & no maps app — extreme edge case */
  });
}

/**
 * Itinéraire vers une position `"lat,lng"` : ouvre Google Maps directement,
 * sans choix. Position vide ou invalide : ne fait rien.
 */
export function ouvrirItineraire(position: string): void {
  const point = lirePosition(position);
  if (!point) return;
  Linking.openURL(urlGoogleMaps(point)).catch(() => {
    dialog.error('Itinéraire', "Impossible d'ouvrir l'application de navigation.");
  });
}
