import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { versementsApi } from './api';
import { versementKeys } from './keys';
import type { UUID } from '../../types/api';

/**
 * Récupère la situation versement (valeurAchat, margeCumulee, detteAvant,
 * totalDu) pour le couple (livreurId, fournisseurId) sur la plage donnée.
 * Désactivé tant qu'un des paramètres est vide.
 */
export function useVersementSituation(params: {
  livreurId: UUID;
  fournisseurId: UUID;
  dateDebut: string;
  dateFin: string;
}) {
  const enabled =
    !!params.livreurId &&
    !!params.fournisseurId &&
    !!params.dateDebut &&
    !!params.dateFin;
  return useQuery({
    queryKey: versementKeys.situation(params),
    queryFn: () => versementsApi.situation(params),
    enabled,
  });
}

/**
 * Mutation : enregistre un versement. À l'issue, invalide tout le scope
 * `versements` (situation incluse) pour forcer un recalcul à l'écran.
 */
export function useEnregistrerVersement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: versementsApi.enregistrer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: versementKeys.all });
    },
  });
}
