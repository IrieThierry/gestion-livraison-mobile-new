import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cloturesApi } from './api';
import { livraisonKeys } from '../livraisons/keys';
import { encaissementKeys } from '../encaissements/keys';
import type { EnregistrerClotureRequest, UUID } from '../../types/api';

const clotureKeys = {
  all: ['clotures'] as const,
  byLivreur: (id: UUID) => ['clotures', 'livreur', id] as const,
  byParent: (id: UUID) => ['clotures', 'parent', id] as const,
};

export function useCloturesByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: clotureKeys.byLivreur(livreurId ?? ''),
    queryFn: () => cloturesApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

export function useCloturesByParent(parentId: UUID | undefined) {
  return useQuery({
    queryKey: clotureKeys.byParent(parentId ?? ''),
    queryFn: () => cloturesApi.byParent(parentId as UUID),
    enabled: !!parentId,
  });
}

export function useEnregistrerCloture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnregistrerClotureRequest) => cloturesApi.enregistrer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clotureKeys.all });
      // La clôture peut potentiellement marquer des livraisons / encaissements
      // comme verrouillés côté back — on invalide aussi par sécurité.
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
    },
  });
}
