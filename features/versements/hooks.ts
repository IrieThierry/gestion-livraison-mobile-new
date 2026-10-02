import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { versementsApi } from './api';
import { versementKeys } from './keys';
import { commandeKeys } from '../commandes/keys';
import type { UUID } from '../../types/api';

/**
 * Situation du versement à venir pour le couple (livreurId, fournisseurId) et la
 * sélection de commandes (liste vide = versement libre). Activé dès que le livreur
 * et le fournisseur sont connus.
 */
export function useVersementSituation(params: {
  livreurId: UUID;
  fournisseurId: UUID;
  commandeIds: UUID[];
}) {
  const enabled = !!params.livreurId && !!params.fournisseurId;
  return useQuery({
    queryKey: versementKeys.situation(params),
    queryFn: () => versementsApi.situation(params),
    enabled,
  });
}

/**
 * Mutation : enregistre un versement. À l'issue, invalide le scope `versements`
 * (situation incluse) ET les commandes (la liste « à régler » change).
 */
export function useEnregistrerVersement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: versementsApi.enregistrer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: versementKeys.all });
      qc.invalidateQueries({ queryKey: commandeKeys.all });
    },
  });
}
