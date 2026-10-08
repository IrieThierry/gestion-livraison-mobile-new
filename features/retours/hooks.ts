import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EnregistrerRetourRequest, FiltresRetours } from '../../types/api';
import { retoursApi } from './api';
import { retourKeys } from './keys';
import { livraisonKeys } from '../livraisons/keys';
import { stockKeys } from '../stock/keys';
import { encaissementKeys } from '../encaissements/keys';
import { clientKeys, encoursKeys } from '../clients/keys';
import { reversementKeys } from '../reversements/keys';

/** Journal des retours, paginé (page à partir de 0) ; les filtres excluent `page`. */
export function useRetours(filtres: Omit<FiltresRetours, 'page'>) {
  return useInfiniteQuery({
    queryKey: retourKeys.liste(filtres),
    queryFn: ({ pageParam }) => retoursApi.lister({ ...filtres, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (derniere) =>
      (derniere.page + 1) * derniere.taille < derniere.total ? derniere.page + 1 : undefined,
  });
}

/**
 * Enregistre un retour (`POST /retour`, une transaction côté back) : le journal,
 * les cumuls de la livraison, le stock du livreur et le dû du client bougent
 * ensemble. Après un échec (409 retour concurrent...), on recharge livraisons
 * et journal pour que le formulaire reparte de données fraîches.
 */
export function useEnregistrerRetour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnregistrerRetourRequest) => retoursApi.enregistrer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retourKeys.all });
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: reversementKeys.all });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: retourKeys.all });
    },
  });
}
