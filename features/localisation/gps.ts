import * as Location from 'expo-location';
import { formaterPosition } from '../../lib/position';

/** Délai maximal d'une lecture GPS (spec C : une seule lecture, 15 s au plus). */
export const DELAI_GPS_MS = 15_000;

/**
 * Une seule lecture GPS, à la demande (aucun suivi ni tâche de fond) : la
 * permission est demandée maintenant (refus → `Error('PERMISSION')`), puis
 * précision équilibrée en course avec 15 s (`Error('DELAI')`). Rend `"lat,lng"`.
 */
export async function lireUnePosition(): Promise<string> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('PERMISSION');
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error('DELAI')), DELAI_GPS_MS);
  });
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      delai,
    ]);
    return formaterPosition(pos.coords.latitude, pos.coords.longitude);
  } finally {
    clearTimeout(minuteur);
  }
}
