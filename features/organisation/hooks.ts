import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import type { CreerDemandeChargementRequest, FiltresDocumentsVente, UUID } from '../../types/api';
import { organisationApi } from './api';
import { organisationKeys } from './keys';
import { estCommercial, estMembreOrganisation } from './regles';

/** Organisation de l'utilisateur (mentions, logo) ; désactivée hors organisation. */
export function useMonOrganisation() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: organisationKeys.moi(),
    queryFn: organisationApi.moi,
    enabled: estMembreOrganisation(user),
    staleTime: 5 * 60_000,
  });
}

/** Demandes de chargement du commercial connecté, les plus récentes d'abord. */
export function useMesDemandesChargement() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: organisationKeys.demandes(),
    queryFn: () => organisationApi.mesDemandes(),
    enabled: estCommercial(user),
    staleTime: 0,
  });
}

/** Création et annulation : réussies ou non, la liste est relue. */
export function useCreerDemandeChargement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreerDemandeChargementRequest) => organisationApi.creerDemande(p),
    onSettled: () => qc.invalidateQueries({ queryKey: organisationKeys.demandes() }),
  });
}

export function useAnnulerDemandeChargement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => organisationApi.annulerDemande(id),
    onSettled: () => qc.invalidateQueries({ queryKey: organisationKeys.demandes() }),
  });
}

/** Factures du commercial (cloisonnées par le back) sur une période. */
export function useMesFactures(filtres: FiltresDocumentsVente) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: organisationKeys.factures(filtres),
    queryFn: () => organisationApi.factures(filtres),
    enabled: estMembreOrganisation(user),
  });
}

/** Avoirs du commercial sur une période. */
export function useMesAvoirs(filtres: FiltresDocumentsVente) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: organisationKeys.avoirs(filtres),
    queryFn: () => organisationApi.avoirs(filtres),
    enabled: estMembreOrganisation(user),
  });
}
