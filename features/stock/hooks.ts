import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockApi } from './api';
import { stockKeys } from './keys';
import type { EnregistrerStockRequest, UUID } from '../../types/api';

// Mirror des hooks lecture du web (gestion-livraison-front/src/features/stock/hooks.ts)
// — on n'a besoin que des deux sources de lecture pour la Task 22.

/**
 * Stock embarqué par fournisseur (par tuple produit × fournisseur).
 * Utilisé par l'écran "Mon stock" mobile.
 */
export function useStockActuel(livreurId: UUID) {
  return useQuery({
    queryKey: stockKeys.actuel(livreurId),
    queryFn: () => stockApi.actuel(livreurId),
    enabled: !!livreurId,
  });
}

/**
 * Stock courant agrégé par produit (somme tous fournisseurs confondus).
 * Optionnel pour la Task 22 ; exposé pour parité avec le web.
 */
export function useStockCourant(dateDebut?: string, dateFin?: string) {
  return useQuery({
    queryKey: stockKeys.courant(dateDebut, dateFin),
    queryFn: () => stockApi.courant(dateDebut, dateFin),
  });
}

/**
 * Stock embarqué de l'équipe (root + apprentis). Pour l'écran « Stock
 * équipe » du livreur racine.
 */
export function useStockActuelParent(parentId: UUID) {
  return useQuery({
    queryKey: stockKeys.parentActuel(parentId),
    queryFn: () => stockApi.actuelParent(parentId),
    enabled: !!parentId,
  });
}

/**
 * Déclare un achat (entrée de stock) chez un fournisseur. Sur succès, on
 * invalide tout le sous-arbre `['stock']` du cache pour que la page "Mon
 * stock" et les agrégats `courant` se rafraîchissent automatiquement.
 */
export function useEnregistrerAchat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnregistrerStockRequest) =>
      stockApi.enregistrerAchat(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}
