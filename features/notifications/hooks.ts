import { useCallback, useRef } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import type { NotificationResponse, UUID } from '../../types/api';
import { notificationsApi } from './api';
import { curseurSuivant, INTERVALLE_NOTIFICATIONS_MS } from './regles';

export const notificationKeys = {
  all: ['notifications'] as const,
  fil: () => [...notificationKeys.all, 'fil'] as const,
  compte: () => [...notificationKeys.all, 'compte'] as const,
};

type Fil = InfiniteData<NotificationResponse[], string | undefined>;

/** Fil paginé (curseur = id de la dernière reçue), relu toutes les 30 s. */
export function useFilNotifications(enabled = true) {
  return useInfiniteQuery({
    queryKey: notificationKeys.fil(),
    queryFn: ({ pageParam }) => notificationsApi.lister(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (derniere: NotificationResponse[]) => curseurSuivant(derniere),
    refetchInterval: INTERVALLE_NOTIFICATIONS_MS,
    enabled,
  });
}

/** Compteur de non lues (badge de la cloche), relu toutes les 30 s. */
export function useNombreNonLues(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.compte(),
    queryFn: notificationsApi.compterNonLues,
    refetchInterval: INTERVALLE_NOTIFICATIONS_MS,
    enabled,
  });
}

/** Marque les notifications du fil en cache comme lues (toutes, ou celle `id`). */
function marquerEnCache(fil: Fil | undefined, id?: UUID): Fil | undefined {
  if (!fil) return fil;
  return {
    ...fil,
    pages: fil.pages.map((page) => page.map((n) => (!n.lue && (!id || n.id === id) ? { ...n, lue: true } : n))),
  };
}

/** Un appui : la notification passe lue tout de suite (cache), puis le serveur confirme. */
export function useMarquerLue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => notificationsApi.marquerLue(id),
    onMutate: (id: UUID) => {
      const fil = qc.getQueryData<Fil>(notificationKeys.fil());
      const etaitNonLue = fil?.pages.some((p) => p.some((n) => n.id === id && !n.lue)) ?? false;
      qc.setQueryData<Fil>(notificationKeys.fil(), (f) => marquerEnCache(f, id));
      if (etaitNonLue) qc.setQueryData<number>(notificationKeys.compte(), (c) => Math.max(0, (c ?? 1) - 1));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.compte() });
      qc.invalidateQueries({ queryKey: notificationKeys.fil() });
    },
  });
}

/** « Tout marquer comme lu ». */
export function useToutMarquerLu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.toutMarquerLu(),
    onSuccess: (nonLues: number) => {
      qc.setQueryData<Fil>(notificationKeys.fil(), (f) => marquerEnCache(f));
      qc.setQueryData<number>(notificationKeys.compte(), nonLues);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.compte() });
      qc.invalidateQueries({ queryKey: notificationKeys.fil() });
    },
  });
}

/**
 * Relecture au retour sur l'écran (N8 f) : `relire` est appelé à chaque
 * reprise du focus, pas au premier affichage (la requête vient d'être lancée).
 */
export function useRelireAuFocus(relire: () => void) {
  const premier = useRef(true);
  const ref = useRef(relire);
  ref.current = relire;
  useFocusEffect(
    useCallback(() => {
      if (premier.current) {
        premier.current = false;
        return;
      }
      ref.current();
    }, []),
  );
}
