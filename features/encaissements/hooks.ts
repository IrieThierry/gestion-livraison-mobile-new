import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreerEncaissementLivraisonRequest, UUID } from '../../types/api';
import { encaissementsApi, type SituationEncaissementParams } from './api';
import { encaissementKeys } from './keys';
import { livraisonKeys } from '../livraisons/keys';
import { clientKeys, encoursKeys } from '../clients/keys';
import { remiseKeys } from '../remise/keys';
import { reversementKeys } from '../reversements/keys';

export function useEncaissementsByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: encaissementKeys.byLivreur(livreurId ?? ''),
    queryFn: () => encaissementsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

/** Situation serveur d'un client sur une plage (mode « sur une période »). */
export function useSituationEncaissement(params: SituationEncaissementParams | null) {
  return useQuery({
    queryKey: params
      ? encaissementKeys.situation(params)
      : [...encaissementKeys.all, 'situation', 'aucune'],
    queryFn: () => encaissementsApi.situation(params as SituationEncaissementParams),
    enabled: !!params,
  });
}

/**
 * Encaissement d'un paiement client. Renvoie l'encaissement créé par le
 * serveur (avec `detteApres`).
 * Invalide livraisons (statut d'encaissement), encaissements, encours,
 * clients, remises et reversements (une remise devient acquise quand la
 * livraison est entièrement payée).
 */
export function useCreerEncaissement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerEncaissementLivraisonRequest) =>
      encaissementsApi.creer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: remiseKeys.all });
      // Remise « en attente » → « acquise » dans la synthèse reversements.
      qc.invalidateQueries({ queryKey: reversementKeys.all });
    },
  });
}
