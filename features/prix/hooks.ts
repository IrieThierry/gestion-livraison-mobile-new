import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prixApi } from './api';
import { prixKeys } from './keys';
import type {
  UpsertPrixClientRequest,
  UpsertPrixLivreurRequest,
  UUID,
} from '../../types/api';

// ============================================================================
// Prix par défaut du livreur — page « Mes prix »
// ============================================================================

/**
 * Liste des prix par défaut du livreur connecté. Source de vérité pour
 * la page « Mes prix » (mobile + web). Visible aussi par les apprentis
 * du livreur (héritage hiérarchique côté back).
 */
export function useMesPrix() {
  return useQuery({
    queryKey: prixKeys.mesPrix(),
    queryFn: prixApi.mesPrix,
    staleTime: 60_000,
  });
}

export function useUpsertPrixLivreur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpsertPrixLivreurRequest) => prixApi.upsertPrixLivreur(p),
    onSuccess: () => {
      // Invalide tout le sous-arbre prix car cela impacte aussi le
      // résolveur (cascade) et potentiellement la liste prix-client.
      qc.invalidateQueries({ queryKey: prixKeys.all });
    },
  });
}

export function useSupprimerPrixLivreur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (produitId: UUID) => prixApi.supprimerPrixLivreur(produitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prixKeys.all });
    },
  });
}

// ============================================================================
// Prix custom par client — page « Prix » sur la fiche client
// ============================================================================

/**
 * Liste des prix custom mémorisés pour un client donné. Utilisé sur la
 * page « Prix » de la fiche client.
 */
export function usePrixClient(clientId: UUID | undefined) {
  return useQuery({
    queryKey: prixKeys.prixClient(clientId ?? ''),
    queryFn: () => prixApi.prixClient(clientId as UUID),
    enabled: !!clientId,
    staleTime: 60_000,
  });
}

export function useUpsertPrixClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpsertPrixClientRequest) => prixApi.upsertPrixClient(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prixKeys.all });
    },
  });
}

export function useSupprimerPrixClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clientId: UUID; produitId: UUID }) =>
      prixApi.supprimerPrixClient(input.clientId, input.produitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prixKeys.all });
    },
  });
}

// ============================================================================
// Résolveur (cascade CLIENT → LIVREUR → null) — utilisé dans ProduitPicker
// ============================================================================

/**
 * Résout le prix d'un (client, produit) en cascade :
 *   1. prix custom client (table `prix_client_produit`)
 *   2. prix par défaut livreur (table `prix_livreur_produit`)
 *   3. null → aucun prix mémorisé, fallback côté UI
 *
 * `enabled` est false tant qu'on n'a pas les deux IDs — évite un appel
 * inutile pendant que le livreur n'a pas encore choisi le client.
 */
export function useResoudrePrix(clientId: UUID | undefined, produitId: UUID | undefined) {
  return useQuery({
    queryKey: prixKeys.resoudre(clientId ?? '', produitId ?? ''),
    queryFn: () => prixApi.resoudre(clientId!, produitId!),
    enabled: !!clientId && !!produitId,
    staleTime: 30_000,
  });
}
