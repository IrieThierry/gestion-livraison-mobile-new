import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      // Idem côté mutations : ne pas spammer le back avec un POST en boucle
      // sur erreur d'auth.
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 1;
      },
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'GL_QUERY_CACHE',
  throttleTime: 1000,
});
