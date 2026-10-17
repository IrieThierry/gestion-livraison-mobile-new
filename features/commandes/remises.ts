import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commandesApi } from './api';
import { commandeKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { etatsKeys } from '../etats/keys';
import { versementKeys } from '../versements/keys';
import { reversementKeys } from '../reversements/keys';
import { useTempsReelConnecte } from '../temps-reel/connexion';
import type { UUID } from '../../types/api';

/** Relecture des remises à confirmer quand le temps réel n'est pas connecté. */
export const INTERVALLE_REMISES_MS = 30_000;

/** Remises du commis d'une commande (lues seulement si la commande en a ou passe par un commis). */
export function useRemisesCommisDeCommande(id: UUID | undefined, enabled = true) {
  return useQuery({
    queryKey: commandeKeys.remisesCommis(id ?? ''),
    queryFn: () => commandesApi.remisesCommis(id!),
    enabled: enabled && !!id,
    staleTime: 0,
  });
}

/**
 * Remises en attente de confirmation par le livreur connecté (titulaire ou
 * apprenti affecté), relues toutes les 30 s sauf temps réel connecté (une
 * notification REMISE_COMMIS_A_CONFIRMER les relit alors).
 */
export function useRemisesCommisAConfirmer(enabled = true) {
  const connecte = useTempsReelConnecte();
  return useQuery({
    queryKey: commandeKeys.remisesAConfirmer(),
    queryFn: commandesApi.remisesAConfirmer,
    enabled,
    refetchInterval: connecte ? false : INTERVALLE_REMISES_MS,
  });
}

/** Une remise confirmée devient une réception : commande, stock et montants à régler changent. */
export function useConfirmerRemiseCommis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => commandesApi.confirmerRemise(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commandeKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: etatsKeys.all });
      qc.invalidateQueries({ queryKey: versementKeys.all });
      qc.invalidateQueries({ queryKey: reversementKeys.all });
    },
    // Remise annulée par le commis entre-temps (400) : on repart de données fraîches.
    onError: () => {
      qc.invalidateQueries({ queryKey: commandeKeys.all });
    },
  });
}

/** Une remise refusée ne compte pas : seules la commande et ses remises changent. */
export function useRefuserRemiseCommis() {
  const qc = useQueryClient();
  const relire = () => {
    qc.invalidateQueries({ queryKey: commandeKeys.all });
  };
  return useMutation({
    mutationFn: ({ id, motif }: { id: UUID; motif: string }) => commandesApi.refuserRemise(id, motif),
    onSuccess: relire,
    onError: relire,
  });
}
