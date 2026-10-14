import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { demandesModifApi } from './api';
import { versementKeys } from '../versements/keys';
import { commandeKeys } from '../commandes/keys';
import { etatsKeys } from '../etats/keys';
import type { CreerDemandeModifVersementRequest, UUID } from '../../types/api';

export const demandeModifKeys = {
  all: ['demandes-modif-versement'] as const,
};

/** Demandes visibles par le livreur (reçues et envoyées, tous statuts). */
export function useDemandesModif(enabled = true) {
  return useQuery({
    queryKey: demandeModifKeys.all,
    queryFn: demandesModifApi.lister,
    enabled,
  });
}

export function useCreerDemandeModif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerDemandeModifVersementRequest) => demandesModifApi.creer(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: demandeModifKeys.all }),
  });
}

/** Approuver : le versement est modifié et la chaîne de dette recalculée. */
export function useApprouverDemandeModif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => demandesModifApi.approuver(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demandeModifKeys.all });
      qc.invalidateQueries({ queryKey: versementKeys.all });
      qc.invalidateQueries({ queryKey: commandeKeys.all });
      qc.invalidateQueries({ queryKey: etatsKeys.all });
    },
  });
}

export function useRejeterDemandeModif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motif }: { id: UUID; motif: string }) => demandesModifApi.rejeter(id, motif),
    onSuccess: () => qc.invalidateQueries({ queryKey: demandeModifKeys.all }),
  });
}
