import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipeApi } from './api';
import { equipeKeys } from './keys';
import { clientKeys, encoursKeys } from '../clients/keys';
import { useAuthStore } from '../../stores/authStore';
import { peutReaffecter } from './regles';
import type { Bornes } from '../../lib/periode';
import type { ReaffecterClientsEquipeRequest } from '../../types/api';

/**
 * Réaffecte des clients dans l'équipe. Invalide les clients (listes du
 * principal, de l'équipe et des apprentis), les encours (la dette suit le
 * client) et l'historique des réaffectations.
 */
export function useReaffecterClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReaffecterClientsEquipeRequest) => equipeApi.reaffecter(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: equipeKeys.all });
    },
  });
}

/** Historique des réaffectations de l'équipe sur la période ; désactivé hors livreur principal indépendant. */
export function useReaffectations(bornes: Bornes) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: equipeKeys.reaffectations(bornes),
    queryFn: () => equipeApi.reaffectations(bornes),
    enabled: peutReaffecter(user),
  });
}
