import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../auth/api';
import { apprentiSchema } from '../auth/schemas';
import { demandesReinitialisationKeys } from '../apprentis/keys';
import { fournisseurKeys } from './keys';
import type { CommisResponse, CreerCommisRequest, DemandeReinitialisationResponse, UUID } from '../../types/api';

/**
 * Commis du fournisseur (mobile) : création, activation, mot de passe. Mêmes
 * routes et mêmes règles que le portail web (`/fournisseur/me/commis`).
 */

/** Même formulaire que l'apprenti (prénom, nom, téléphone, identifiant, mot de passe provisoire), sans email. */
export const commisSchema = apprentiSchema.omit({ email: true });
export type CommisSaisie = ReturnType<typeof commisSchema.parse>;

/** Corps envoyé au back : l'identifiant est insensible à la casse, il part en minuscules. */
export function payloadCommis(v: CommisSaisie): CreerCommisRequest {
  return {
    prenom: v.prenom.trim(),
    nom: v.nom.trim(),
    contact: v.contact.trim(),
    username: v.username.trim().toLowerCase(),
    password: v.password,
  };
}

export const nomCommis = (c: { prenom?: string | null; nom?: string | null }): string =>
  `${c.prenom ?? ''} ${c.nom ?? ''}`.trim();

export const commisApi = {
  liste: async (): Promise<CommisResponse[]> => (await apiClient.get<CommisResponse[]>('/fournisseur/me/commis')).data,

  creer: async (payload: CreerCommisRequest): Promise<CommisResponse> =>
    (await apiClient.post<CommisResponse>('/fournisseur/me/commis', payload)).data,

  basculer: async (id: UUID, actif: boolean): Promise<CommisResponse> =>
    (await apiClient.put<CommisResponse>(`/fournisseur/me/commis/${id}/actif`, { actif })).data,

  reinitialiserMotDePasse: async (id: UUID): Promise<{ tempPassword: string; message: string }> =>
    (await apiClient.post<{ tempPassword: string; message: string }>(`/fournisseur/me/commis/${id}/reset-password`)).data,

  demandesMotDePasse: async (): Promise<DemandeReinitialisationResponse[]> => {
    const { data } = await apiClient.get<DemandeReinitialisationResponse[]>('/fournisseur/me/commis/demandes-mot-de-passe');
    return Array.isArray(data) ? data : [];
  },
};

const commisKeys = {
  liste: () => [...fournisseurKeys.all, 'commis'] as const,
  demandes: () => [...fournisseurKeys.all, 'commis', 'demandes'] as const,
};

function useEstFournisseur(): boolean {
  return useAuthStore((s) => s.user?.profile === 'FOURNISSEUR');
}

export function useCommisFournisseur() {
  const actif = useEstFournisseur();
  return useQuery({ queryKey: commisKeys.liste(), queryFn: commisApi.liste, staleTime: 15_000, enabled: actif });
}

/** Demandes « Mot de passe oublié » des commis, relues toutes les 60 s. */
export function useDemandesMotDePasseCommis() {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: commisKeys.demandes(),
    queryFn: commisApi.demandesMotDePasse,
    staleTime: 30_000,
    refetchInterval: actif ? 60_000 : false,
    enabled: actif,
  });
}

export function useCreerCommis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: commisApi.creer,
    onSuccess: () => qc.invalidateQueries({ queryKey: commisKeys.liste() }),
  });
}

export function useBasculerCommis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actif }: { id: UUID; actif: boolean }) => commisApi.basculer(id, actif),
    onSuccess: () => qc.invalidateQueries({ queryKey: commisKeys.liste() }),
  });
}

/** Le back marque la demande traitée : la liste des demandes est relue. */
export function useReinitialiserMotDePasseCommis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => commisApi.reinitialiserMotDePasse(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commisKeys.demandes() });
      qc.invalidateQueries({ queryKey: demandesReinitialisationKeys.all });
    },
  });
}

/** Ignorer une fausse demande (route existante) : la liste est relue. */
export function useIgnorerDemandeCommis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => authApi.ignorerDemandeReinitialisation(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: commisKeys.demandes() });
      qc.invalidateQueries({ queryKey: demandesReinitialisationKeys.all });
    },
  });
}
