import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from './api';
import { clientKeys } from './keys';
import type {
  CreerClientRequest,
  ModifierClientRequest,
  UUID,
} from '../../types/api';

export function useClientsByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: clientKeys.byLivreur(livreurId ?? ''),
    queryFn: () => clientsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

export function useEnregistrerClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerClientRequest) => clientsApi.enregistrer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Modifie un client. Invalide tout le sous-arbre `clients` au succès
 * pour que la liste, la fiche et le picker affichent immédiatement
 * les nouvelles infos.
 */
export function useModifierClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModifierClientRequest) => clientsApi.modifier(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
