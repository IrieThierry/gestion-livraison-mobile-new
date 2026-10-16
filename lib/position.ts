/** Point géographique lu d'une position `"lat,lng"`. */
export interface Point {
  lat: number;
  lng: number;
}

/** Mêmes règles que le back (`Position.lire`) : nombres décimaux simples, espaces tolérés autour. */
const FORMAT = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * Lit une position `"lat,lng"` (`-90 ≤ lat ≤ 90`, `-180 ≤ lng ≤ 180`). Vide, mal formée ou hors bornes : null
 * (le client compte alors « sans position », la carte ne plante pas).
 */
export function lirePosition(s?: string | null): Point | null {
  if (!s) return null;
  const m = FORMAT.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) return null;
  return { lat, lng };
}

/** Itinéraire Google Maps jusqu'au point. */
export function urlGoogleMaps(p: Point): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

/** Itinéraire Waze jusqu'au point. */
export function urlWaze(p: Point): string {
  return `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
}

/** Position GPS lue → chaîne `"lat,lng"` arrondie à 6 décimales. */
export function formaterPosition(lat: number, lng: number): string {
  return `${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`;
}
