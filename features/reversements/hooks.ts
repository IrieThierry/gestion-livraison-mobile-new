import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reversementsApi } from './api';
import { encoursKeys } from '../clients/keys';
import { remiseKeys } from '../remise/keys';
import type { EnregistrerReversementRequest } from '../../types/api';

const reversementKeys = {
  all: ['reversements'] as const,
  list: (a: number, m: number) => ['reversements', 'list', a, m] as const,
  syntheseLivreur: (mois: string) => ['reversements', 'synthese-livreur', mois] as const,
};

export function useReversementsListe(annee: number, mois: number) {
  return useQuery({
    queryKey: reversementKeys.list(annee, mois),
    queryFn: () => reversementsApi.list(annee, mois),
  });
}

export function useReversementsSyntheseLivreur(mois: string) {
  return useQuery({
    queryKey: reversementKeys.syntheseLivreur(mois),
    queryFn: () => reversementsApi.syntheseLivreur(mois),
    staleTime: 30_000,
    enabled: !!mois,
  });
}

/**
 * Reversement (remise reversée au client ou marge fournisseur). Le
 * reste à reverser fait partie du compte client : on invalide aussi les
 * encours et les remises.
 */
export function useEnregistrerReversement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: EnregistrerReversementRequest) => reversementsApi.enregistrer(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reversementKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: remiseKeys.all });
    },
  });
}
