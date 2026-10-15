import { SecureStorage } from './secure-storage';

/**
 * Jetons de la session (accès et rafraîchissement), M2 « Se souvenir de moi ».
 *
 *  - Session gardée (case cochée, par défaut) : les jetons vivent en
 *    SecureStorage, comme avant ; l'app rouvre la session au démarrage.
 *  - Session non gardée (case décochée) : les jetons vivent en mémoire
 *    seulement. Fermer l'application ramène à la connexion, et le
 *    déverrouillage biométrique n'est pas proposé (rien n'est gardé).
 *
 * Lu par l'intercepteur axios (`lib/api-client`) et par `authStore`.
 */
export type CleJeton = 'access_token' | 'refresh_token';

let persistant = true;
const memoire = new Map<CleJeton, string>();

export const JetonsSession = {
  /** Vrai si les jetons sont gardés sur le téléphone (case « Se souvenir de moi » cochée). */
  estPersistant(): boolean {
    return persistant;
  },

  /** Choisit le mode de garde des jetons (avant d'écrire ceux d'une nouvelle session). */
  definirPersistance(garder: boolean): void {
    persistant = garder;
    if (garder) memoire.clear();
  },

  async get(cle: CleJeton): Promise<string | null> {
    if (!persistant) return memoire.get(cle) ?? null;
    return SecureStorage.get(cle);
  },

  async set(cle: CleJeton, valeur: string): Promise<void> {
    if (!persistant) {
      memoire.set(cle, valeur);
      return;
    }
    await SecureStorage.set(cle, valeur);
  },

  /** Efface les jetons, en mémoire et sur le téléphone. */
  async effacer(): Promise<void> {
    memoire.clear();
    await SecureStorage.clearAuth();
  },
};
