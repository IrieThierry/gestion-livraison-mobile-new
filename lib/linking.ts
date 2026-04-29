import { Linking, Platform } from 'react-native';

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
 * Open the native maps app with directions to the given coordinates.
 * iOS uses the Apple Maps URL scheme (maps://?daddr=lat,lng); Android uses
 * google.navigation:q=lat,lng for turn-by-turn navigation.
 */
export function navigateTo(lat: number, lng: number, label?: string): void {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;
  const url =
    Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lng}&q=${encodeURIComponent(label ?? '')}`
      : `google.navigation:q=${lat},${lng}`;
  Linking.openURL(url).catch(() => {
    /* maps app not installed */
  });
}
