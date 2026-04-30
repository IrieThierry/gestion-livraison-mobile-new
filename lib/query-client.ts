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
      retry: 1,
      refetchOnReconnect: true,
      // refetchOnWindowFocus est laissé à sa valeur par défaut (`true`)
      // pour que `focusManager.setFocused(true)` déclenche bien le refetch.
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'GL_QUERY_CACHE',
  throttleTime: 1000,
});
