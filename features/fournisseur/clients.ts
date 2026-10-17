import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/authStore';
import { FORMAT_CONTACT, MESSAGES_COMPTE } from '../auth/schemas';
import { fournisseurKeys } from './keys';
import type {
  ClientFournisseurResponse,
  EnregistrerVersementClientRequest,
  ModeVersementClient,
  PrixClientResponse,
  SituationClientResponse,
  SortieClientResponse,
  UUID,
  VersementClientResponse,
} from '../../types/api';

/**
 * Clients du fournisseur (mobile) : liste et dû, prix par client, situation
 * (sorties, versements), versements, annulation d'une sortie. Mêmes routes et
 * mêmes règles que le portail web (`/fournisseur/me/clients`).
 */

export const MESSAGE_PRIX_CLIENT = 'Le prix doit être supérieur à 0.';
export const MESSAGE_MONTANT_VERSEMENT_CLIENT = 'Le montant doit être supérieur à 0.';
export const MESSAGE_NOM_CLIENT = 'Le nom du client est obligatoire.';
export const MESSAGE_NOM_CLIENT_LONG = 'Le nom du client ne doit pas dépasser 100 caractères.';

/** Modes de versement d'un client, dans l'ordre proposé. */
export const MODES_VERSEMENT_CLIENT: Array<{ valeur: ModeVersementClient; label: string }> = [
  { valeur: 'ESPECES', label: 'Espèces' },
  { valeur: 'MOBILE_MONEY', label: 'Mobile Money' },
  { valeur: 'VIREMENT', label: 'Virement' },
  { valeur: 'AUTRE', label: 'Autre' },
];

export function libelleModeVersement(mode: ModeVersementClient): string {
  return MODES_VERSEMENT_CLIENT.find((m) => m.valeur === mode)?.label ?? mode;
}

export type LectureMontantClient = { ok: true; valeur: number } | { ok: false; erreur: string };

/** Montant saisi (virgule ou point) : strictement positif, au plus 2 décimales. */
function lireMontantPositif(saisie: string, message: string): LectureMontantClient {
  const texte = saisie.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(texte)) return { ok: false, erreur: message };
  const valeur = Number(texte);
  return valeur > 0 ? { ok: true, valeur } : { ok: false, erreur: message };
}

export const lirePrixClient = (saisie: string): LectureMontantClient => lireMontantPositif(saisie, MESSAGE_PRIX_CLIENT);

export const lireMontantVersementClient = (saisie: string): LectureMontantClient =>
  lireMontantPositif(saisie, MESSAGE_MONTANT_VERSEMENT_CLIENT);

/** Nom et téléphone facultatif d'un client ; null = valide. */
export function erreurClient(nom: string, contact: string): { nom?: string; contact?: string } | null {
  const erreurs: { nom?: string; contact?: string } = {};
  const n = nom.trim();
  if (n === '') erreurs.nom = MESSAGE_NOM_CLIENT;
  else if (n.length > 100) erreurs.nom = MESSAGE_NOM_CLIENT_LONG;
  if (contact.trim() !== '' && !FORMAT_CONTACT.test(contact.trim())) erreurs.contact = MESSAGES_COMPTE.contact;
  return erreurs.nom || erreurs.contact ? erreurs : null;
}

/** Prix appliqué à ce client : son prix propre, sinon le prix du catalogue. */
export function prixAffiche(l: Pick<PrixClientResponse, 'prixCatalogue' | 'prixClient'>): { prix: number; propre: boolean } {
  return l.prixClient === null ? { prix: l.prixCatalogue, propre: false } : { prix: l.prixClient, propre: true };
}

/** Dû affiché en rouge quand le client doit de l'argent. */
export const couleurDu = (du: number): 'rouge' | 'neutre' => (du > 0 ? 'rouge' : 'neutre');

export const clientsApi = {
  liste: async (): Promise<ClientFournisseurResponse[]> =>
    (await apiClient.get<ClientFournisseurResponse[]>('/fournisseur/me/clients')).data,

  creer: async (payload: { nom: string; contact: string }): Promise<ClientFournisseurResponse> =>
    (await apiClient.post<ClientFournisseurResponse>('/fournisseur/me/clients', payload)).data,

  modifier: async (
    id: UUID,
    payload: { nom: string; contact: string; actif: boolean },
  ): Promise<ClientFournisseurResponse> =>
    (await apiClient.put<ClientFournisseurResponse>(`/fournisseur/me/clients/${id}`, payload)).data,

  /** Produits actifs du catalogue avec le prix propre au client (null = prix du catalogue). */
  prix: async (clientId: UUID): Promise<PrixClientResponse[]> =>
    (await apiClient.get<PrixClientResponse[]>(`/fournisseur/me/clients/${clientId}/prix`)).data,

  fixerPrix: async (clientId: UUID, pfId: UUID, prix: number): Promise<PrixClientResponse> =>
    (await apiClient.put<PrixClientResponse>(`/fournisseur/me/clients/${clientId}/prix/${pfId}`, { prix })).data,

  retirerPrix: async (clientId: UUID, pfId: UUID): Promise<PrixClientResponse> =>
    (await apiClient.delete<PrixClientResponse>(`/fournisseur/me/clients/${clientId}/prix/${pfId}`)).data,

  situation: async (clientId: UUID): Promise<SituationClientResponse> =>
    (await apiClient.get<SituationClientResponse>(`/fournisseur/me/clients/${clientId}/situation`)).data,

  enregistrerVersement: async (
    clientId: UUID,
    payload: EnregistrerVersementClientRequest,
  ): Promise<VersementClientResponse> =>
    (await apiClient.post<VersementClientResponse>(`/fournisseur/me/clients/${clientId}/versements`, payload)).data,

  /** Le fournisseur annule une sortie de n'importe quelle date (irréversible). */
  annulerSortie: async (sortieId: UUID): Promise<SortieClientResponse> =>
    (await apiClient.post<SortieClientResponse>(`/fournisseur/me/sorties/${sortieId}/annuler`)).data,
};

const clientsKeys = {
  racine: () => [...fournisseurKeys.all, 'clients'] as const,
  prix: (id: UUID) => [...fournisseurKeys.all, 'clients', 'prix', id] as const,
  situation: (id: UUID) => [...fournisseurKeys.all, 'clients', 'situation', id] as const,
};

function useEstFournisseur(): boolean {
  return useAuthStore((s) => s.user?.profile === 'FOURNISSEUR');
}

export function useClientsFournisseur() {
  const actif = useEstFournisseur();
  return useQuery({ queryKey: [...clientsKeys.racine(), 'liste'], queryFn: clientsApi.liste, staleTime: 15_000, enabled: actif });
}

export function useCreerClientFournisseur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clientsApi.creer,
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.racine() }),
  });
}

export function useModifierClientFournisseur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: UUID; nom: string; contact: string; actif: boolean }) =>
      clientsApi.modifier(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.racine() }),
  });
}

export function usePrixClient(clientId: UUID | undefined) {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: clientsKeys.prix(clientId ?? ''),
    queryFn: () => clientsApi.prix(clientId!),
    staleTime: 0,
    enabled: actif && !!clientId,
  });
}

export function useFixerPrixClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, pfId, prix }: { clientId: UUID; pfId: UUID; prix: number }) =>
      clientsApi.fixerPrix(clientId, pfId, prix),
    onSuccess: (_d, { clientId }) => qc.invalidateQueries({ queryKey: clientsKeys.prix(clientId) }),
  });
}

export function useRetirerPrixClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, pfId }: { clientId: UUID; pfId: UUID }) => clientsApi.retirerPrix(clientId, pfId),
    onSuccess: (_d, { clientId }) => qc.invalidateQueries({ queryKey: clientsKeys.prix(clientId) }),
  });
}

export function useSituationClient(clientId: UUID | undefined) {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: clientsKeys.situation(clientId ?? ''),
    queryFn: () => clientsApi.situation(clientId!),
    staleTime: 0,
    enabled: actif && !!clientId,
  });
}

/** Le dû change : liste des clients et situations relues. */
export function useEnregistrerVersementClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, payload }: { clientId: UUID; payload: EnregistrerVersementClientRequest }) =>
      clientsApi.enregistrerVersement(clientId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.racine() }),
  });
}

export function useAnnulerSortieClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sortieId: UUID) => clientsApi.annulerSortie(sortieId),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.racine() }),
  });
}
