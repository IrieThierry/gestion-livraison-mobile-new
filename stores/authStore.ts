import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureStorage } from '../lib/secure-storage';
import { JetonsSession } from '../lib/jetons-session';
import { Biometric } from '../lib/biometric';
import {
  lireChoixBiometrie,
  migrerAncienChoixBiometrie,
  type ChoixBiometrie,
} from '../lib/biometrie-choix';
import { CLE_PROPRIETAIRE_CACHE, QUERY_CACHE_KEY, viderCacheRequetes } from '../lib/query-client';
import type { AuthUser } from '../features/auth/api';
import { useCommandePrefillStore } from './commandePrefillStore';

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  /**
   * Persiste l'access token (court, ~15 min) ET le refresh token (long, ~7 j)
   * en SecureStorage, plus l'utilisateur (sans tokens) en AsyncStorage.
   * Appelé par les écrans login + signup.
   */
  setSession: (token: string, refreshToken: string, user: AuthUser, seSouvenir?: boolean) => Promise<void>;
  /**
   * Remplace l'utilisateur de la session (ex. mot de passe provisoire changé)
   * sans toucher aux jetons. Gardé en AsyncStorage si la session est gardée.
   */
  majUtilisateur: (user: AuthUser) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Écran de connexion : une session est gardée (jetons + utilisateur), ce
   * compte a choisi la biométrie (« active ») et l'appareil est compatible.
   * Mêmes conditions que le déverrouillage au démarrage (`hydrate`).
   */
  deverrouillageBiometriquePossible: () => Promise<boolean>;
  /**
   * Déverrouille la session gardée par la biométrie. Rend l'utilisateur
   * restauré, ou null (refus, annulation, ou plus de session gardée).
   */
  deverrouillerParBiometrie: () => Promise<AuthUser | null>;
}

/** Session gardée (jeton d'accès + utilisateur), sans la restaurer ; null sinon. */
async function lireSessionStockee(): Promise<AuthUser | null> {
  const token = await SecureStorage.get('access_token');
  const userRaw = await AsyncStorage.getItem('user');
  if (!token || !userRaw) return null;
  try {
    return JSON.parse(userRaw) as AuthUser;
  } catch {
    return null;
  }
}

/** Utilisateur de la session gardée si son déverrouillage biométrique peut marcher. */
async function sessionDeverrouillable(): Promise<AuthUser | null> {
  try {
    const user = await lireSessionStockee();
    if (!user?.username) return null;
    if ((await lireChoixBiometrie(user.username)) !== 'active') return null;
    return (await Biometric.isAvailable()) ? user : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isHydrated: false,

  // Le back renvoie `token` (access, ~15 min) + `refreshToken` (long, ~7 j).
  // Les deux vivent en SecureStorage (chiffré). L'access est lu par
  // l'intercepteur axios à chaque requête, le refresh est utilisé quand
  // l'access répond 401 pour obtenir un nouveau couple.
  // Le user (sans tokens) est en AsyncStorage pour rendu rapide au démarrage.
  //
  // M2 « Se souvenir de moi » décoché (`seSouvenir === false`) : jetons en
  // mémoire seulement, rien n'est gardé sur le téléphone (une session gardée
  // d'avant est effacée). Fermer l'app ramène à la connexion.
  //
  // Cache des requêtes : jamais celui d'un autre compte (vidé si le compte
  // change) ; session non gardée : le cache persisté est effacé et plus
  // rien n'est écrit (`queryPersister`).
  setSession: async (token, refreshToken, user, seSouvenir = true) => {
    let proprietaire: string | null = null;
    try {
      proprietaire = await AsyncStorage.getItem(CLE_PROPRIETAIRE_CACHE);
    } catch {
      // Illisible : le cache est vidé (cas le plus sûr).
    }
    if (proprietaire !== user.id) await viderCacheRequetes();
    else if (!seSouvenir) await AsyncStorage.removeItem(QUERY_CACHE_KEY);
    await AsyncStorage.setItem(CLE_PROPRIETAIRE_CACHE, user.id);
    if (!seSouvenir) {
      await JetonsSession.effacer();
      await AsyncStorage.removeItem('user');
    }
    JetonsSession.definirPersistance(seSouvenir);
    await JetonsSession.set('access_token', token);
    await JetonsSession.set('refresh_token', refreshToken);
    if (seSouvenir) await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  majUtilisateur: async (user) => {
    if (JetonsSession.estPersistant()) await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  hydrate: async () => {
    const token = await SecureStorage.get('access_token');
    const userRaw = await AsyncStorage.getItem('user');
    if (!token || !userRaw) {
      // Pas de session restaurable : aucune donnée d'une session précédente
      // (par exemple « Se souvenir de moi » décoché) ne reste sur le téléphone.
      await viderCacheRequetes().catch(() => undefined);
      set({ user: null, isHydrated: true });
      return;
    }

    let user: AuthUser;
    try {
      user = JSON.parse(userRaw) as AuthUser;
    } catch {
      set({ user: null, isHydrated: true });
      return;
    }

    // Biometric gate (only if this account chose « active », S4). If the device
    // no longer supports biometric (rare), we fall through and log the
    // user in normally — never lock them out.
    let choix: ChoixBiometrie | null = null;
    try {
      choix = user?.username ? await migrerAncienChoixBiometrie(user.username) : null;
    } catch {
      // Choix illisible : on ne restaure pas la session sans vérification
      // (fail-closed). Jetons gardés : connexion normale à l'écran de login.
      set({ user: null, isHydrated: true });
      return;
    }
    if (choix === 'active' && (await Biometric.isAvailable())) {
      const ok = await Biometric.authenticate('Déverrouille Gestion Livraison');
      if (!ok) {
        // Don't wipe tokens — user may retry by reopening the app or
        // by entering credentials again on the login screen.
        set({ user: null, isHydrated: true });
        return;
      }
    }

    set({ user, isHydrated: true });
  },

  logout: async () => {
    await JetonsSession.effacer();
    JetonsSession.definirPersistance(true);
    await AsyncStorage.removeItem('user');
    // Cache d'un autre utilisateur : vidé en mémoire ET dans le stockage persisté.
    await viderCacheRequetes();
    // Préremplissage « Commander » non consommé : jamais repris par un autre compte.
    useCommandePrefillStore.getState().vider();
    set({ user: null });
  },

  deverrouillageBiometriquePossible: async () => (await sessionDeverrouillable()) !== null,

  deverrouillerParBiometrie: async () => {
    const user = await sessionDeverrouillable();
    if (!user) return null;
    try {
      if (!(await Biometric.authenticate('Déverrouille Gestion Livraison'))) return null;
    } catch {
      return null;
    }
    set({ user, isHydrated: true });
    return user;
  },
}));
