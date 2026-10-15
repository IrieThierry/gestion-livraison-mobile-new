import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Persister } from '@tanstack/react-query-persist-client';
import { JetonsSession } from './jetons-session';

/**
 * Configuration des requêtes par défaut.
 *
 * - `staleTime: 30s` : court — quand le user revient sur un onglet déjà
 *   ouvert ou que l'app revient au premier plan après plus de 30s, les
 *   données sont considérées « stale » et un refetch est déclenché. Ça
 *   couvre le cas « j'ai créé un client sur le web, je veux le voir sur
 *   le mobile sans tirer manuellement vers le bas ».
 *
 * - `gcTime: 24h` : long — on garde le cache 24h pour pouvoir hydrater
 *   l'UI hors-ligne (lecture seule) à la prochaine ouverture.
 *
 * - `refetchOnWindowFocus: true` (défaut) + `focusManager` câblé à
 *   `AppState` dans `app/_layout.tsx` → l'app qui passe au premier plan
 *   recharge automatiquement toutes les queries stales.
 *
 * - `refetchOnReconnect: true` : quand le réseau revient, on recharge
 *   tout ce qui est stale (utile après un trajet en zone sans 4G).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      // Retry intelligent : on ne retente PAS sur 401/403/404 (= problème
      // d'auth ou ressource inexistante, retry inutile et provoque un
      // spinner infini si l'interceptor a déjà décidé de rediriger). Pour
      // les vraies erreurs réseau / 5xx, on retente 1 fois.
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 1;
      },
      refetchOnReconnect: true,
      // refetchOnWindowFocus est laissé à sa valeur par défaut (`true`)
      // pour que `focusManager.setFocused(true)` déclenche bien le refetch.
    },
    mutations: {
      // Aucun rejeu automatique : un POST rejoué après une réponse perdue
      // peut dupliquer une écriture (livraison, encaissement...).
      retry: 0,
      // Une mutation lancée alors que `onlineManager` dit « hors ligne »
      // échoue tout de suite au lieu d'être mise en pause puis rejouée au
      // retour du réseau (défense en profondeur : les écrans gardent déjà
      // `isOnline`).
      networkMode: 'always',
    },
  },
});

/** Clé AsyncStorage du cache persisté. */
export const QUERY_CACHE_KEY = 'GL_QUERY_CACHE';

/** Clé AsyncStorage de l'utilisateur gardé (la session restaurable au démarrage). */
const CLE_UTILISATEUR = 'user';

const persisterAsyncStorage = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 1000,
});

/**
 * Cache persisté, seulement pour une session gardée (M2) :
 *  - « Se souvenir de moi » décoché : rien n'est écrit sur le téléphone ;
 *  - au démarrage sans session restaurable (pas d'utilisateur gardé) : le
 *    cache d'une session précédente est effacé, jamais restauré.
 */
export const queryPersister: Persister = {
  persistClient: async (client) => {
    if (!JetonsSession.estPersistant()) return;
    await persisterAsyncStorage.persistClient(client);
  },
  restoreClient: async () => {
    let user: string | null = null;
    try {
      user = await AsyncStorage.getItem(CLE_UTILISATEUR);
    } catch {
      // Illisible : pas de restauration.
    }
    if (!user) {
      try {
        await AsyncStorage.removeItem(QUERY_CACHE_KEY);
      } catch {
        // Rien à effacer.
      }
      return undefined;
    }
    return persisterAsyncStorage.restoreClient();
  },
  removeClient: () => persisterAsyncStorage.removeClient(),
};

/** Clé AsyncStorage de l'id du compte à qui appartient le cache. */
export const CLE_PROPRIETAIRE_CACHE = 'GL_QUERY_CACHE_PROPRIETAIRE';

/** Vide le cache des requêtes, en mémoire et sur le téléphone. */
export async function viderCacheRequetes(): Promise<void> {
  queryClient.clear();
  await AsyncStorage.removeItem(QUERY_CACHE_KEY);
}
