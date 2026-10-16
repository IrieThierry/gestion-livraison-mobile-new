import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { relationKeys } from '../relations/keys';
import { depotApi } from './api';
import { depotKeys } from './keys';
import type { EnregistrerDepotRequest } from '../../types/api';

/** Le dépôt du compte connecté (null s'il n'en a pas). */
export function useDepot() {
  return useQuery({ queryKey: depotKeys.moi(), queryFn: depotApi.moi });
}

/** Dépôts des partenaires visibles (cartes du livreur ou du commercial). */
export function useDepotsVisibles() {
  return useQuery({ queryKey: depotKeys.visibles(), queryFn: depotApi.visibles });
}

function useInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: depotKeys.all });
    qc.invalidateQueries({ queryKey: relationKeys.all });
  };
}

export function useEnregistrerDepot() {
  const invalider = useInvalidation();
  return useMutation({
    mutationFn: (body: EnregistrerDepotRequest) => depotApi.enregistrer(body),
    onSuccess: invalider,
  });
}

export function useRetirerDepot() {
  const invalider = useInvalidation();
  return useMutation({ mutationFn: () => depotApi.retirer(), onSuccess: invalider });
}
