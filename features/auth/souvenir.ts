import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * M2 « Se souvenir de moi » : identifiant prérempli à la connexion suivante.
 * Gardé quand la case est cochée, effacé quand elle est décochée. La
 * déconnexion ne l'efface pas (seuls les jetons et l'utilisateur partent).
 */
export const CLE_IDENTIFIANT_MEMORISE = 'identifiant_memorise';

export async function lireIdentifiantMemorise(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLE_IDENTIFIANT_MEMORISE);
  } catch {
    return null;
  }
}

/** Cochée : garde l'identifiant ; décochée : l'efface. Aucun échec ne bloque la connexion. */
export async function memoriserIdentifiant(seSouvenir: boolean, identifiant: string): Promise<void> {
  try {
    if (seSouvenir && identifiant) await AsyncStorage.setItem(CLE_IDENTIFIANT_MEMORISE, identifiant);
    else await AsyncStorage.removeItem(CLE_IDENTIFIANT_MEMORISE);
  } catch {
    // Préremplissage facultatif.
  }
}
