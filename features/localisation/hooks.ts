import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationKeys } from '../notifications/hooks';
import { INTERVALLE_NOTIFICATIONS_MS } from '../notifications/regles';
import { localisationApi } from './api';
import { localisationKeys } from './keys';
import { useTempsReelConnecte } from '../temps-reel/connexion';
import type { UUID } from '../../types/api';

/** Demandes de position en attente qui me visent (bandeau de l'accueil, écran de réponse). */
export function useDemandesRecues(enabled = true) {
  const connecte = useTempsReelConnecte();
  return useQuery({
    queryKey: localisationKeys.recues(),
    queryFn: localisationApi.recues,
    enabled,
    refetchInterval: connecte ? false : INTERVALLE_NOTIFICATIONS_MS,
  });
}

/** Personnes que je peux localiser (écran Localiser). */
export function usePersonnesLocalisables() {
  const connecte = useTempsReelConnecte();
  return useQuery({
    queryKey: localisationKeys.personnes(),
    queryFn: localisationApi.personnes,
    refetchInterval: connecte ? false : INTERVALLE_NOTIFICATIONS_MS,
  });
}

/** Demander (ou redemander) sa position à une personne. */
export function useDemanderLocalisation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cibleId: UUID) => localisationApi.demander(cibleId),
    onSettled: () => qc.invalidateQueries({ queryKey: localisationKeys.personnes() }),
  });
}

function useApresReponse() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: localisationKeys.recues() });
    qc.invalidateQueries({ queryKey: notificationKeys.all });
  };
}

/** Partager sa position en réponse à une demande. */
export function useAccepterLocalisation() {
  const apres = useApresReponse();
  return useMutation({
    mutationFn: ({ id, position }: { id: UUID; position: string }) => localisationApi.accepter(id, position),
    onSuccess: apres,
  });
}

/** Refuser une demande de position. */
export function useRefuserLocalisation() {
  const apres = useApresReponse();
  return useMutation({
    mutationFn: (id: UUID) => localisationApi.refuser(id),
    onSuccess: apres,
  });
}
