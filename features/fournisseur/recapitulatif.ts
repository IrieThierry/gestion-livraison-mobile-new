import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/authStore';
import { fournisseurKeys } from './keys';
import type { FiltresRecapitulatif, RecapitulatifProduitResponse, RecapitulatifRemisesResponse, UUID } from '../../types/api';

/**
 * Récapitulatif des remises (lecture seule) : par produit, les quantités
 * remises aux livreurs (remises confirmées) et sorties aux clients. Il répond
 * aussi à « produits livrés et quantités avec filtre livreur ». Une remise
 * compte le jour où le commis l'a enregistrée.
 */

export const MESSAGE_PERIODE_RECAPITULATIF = 'La date de début doit précéder la date de fin.';

export const recapitulatifApi = {
  lire: async (filtres: FiltresRecapitulatif): Promise<RecapitulatifRemisesResponse> => {
    const params: Record<string, string> = { debut: filtres.debut, fin: filtres.fin };
    if (filtres.commisId) params.commisId = filtres.commisId;
    if (filtres.livreurId) params.livreurId = filtres.livreurId;
    if (filtres.clientId) params.clientId = filtres.clientId;
    return (await apiClient.get<RecapitulatifRemisesResponse>('/fournisseur/me/recapitulatif', { params })).data;
  },
};

/** Période et filtres choisis (vides ignorés) en paramètres du back. */
export function filtresRecapitulatif(
  bornes: { debut: string; fin: string },
  choix: { commisId?: UUID | null; livreurId?: UUID | null; clientId?: UUID | null },
): FiltresRecapitulatif {
  const f: FiltresRecapitulatif = { debut: bornes.debut, fin: bornes.fin };
  if (choix.commisId) f.commisId = choix.commisId;
  if (choix.livreurId) f.livreurId = choix.livreurId;
  if (choix.clientId) f.clientId = choix.clientId;
  return f;
}

/** Total des quantités remises aux livreurs et sorties aux clients. */
export function totauxRecapitulatif(produits: readonly RecapitulatifProduitResponse[]): { remis: number; sortis: number } {
  return produits.reduce(
    (t, p) => ({ remis: t.remis + p.totalConfirme, sortis: t.sortis + p.totalClients }),
    { remis: 0, sortis: 0 },
  );
}

export function useRecapitulatifRemises(filtres: FiltresRecapitulatif) {
  const actif = useAuthStore((s) => s.user?.profile === 'FOURNISSEUR');
  return useQuery({
    queryKey: [...fournisseurKeys.all, 'recapitulatif', filtres] as const,
    queryFn: () => recapitulatifApi.lire(filtres),
    staleTime: 0,
    enabled: actif && !!filtres.debut && !!filtres.fin,
  });
}
