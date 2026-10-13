import { estMembreOrganisation } from '../organisation/regles';
import { filtrerRecherche } from '../../lib/recherche';
import type {
  AuthResponse,
  ClientResponse,
  LivreurResponse,
  ReaffecterClientsEquipeRequest,
  UUID,
} from '../../types/api';

/**
 * Réaffectation des clients par le livreur principal indépendant (P8) :
 * fonctions pures (droits, cibles, sélection, demande, libellés).
 */

/** Message du back quand ni client ni zone n'est choisi (repris tel quel). */
export const MESSAGE_SANS_CLIENT_NI_ZONE = 'Choisissez des clients ou une zone.';
/** Aucune cible choisie. */
export const MESSAGE_SANS_CIBLE = 'Choisissez l’apprenti qui reprend les clients.';

type UtilisateurEquipe = Pick<AuthResponse, 'parentId' | 'organisationId' | 'organisationRole'> | null | undefined;

/** Livreur principal indépendant : sans parent et hors organisation (le responsable garde le portail web). */
export function peutReaffecter(user: UtilisateurEquipe): boolean {
  return !!user && !user.parentId && !estMembreOrganisation(user);
}

export type ModeReaffectation = 'selection' | 'zone';

export interface CibleReaffectation {
  id: UUID;
  label: string;
  hint?: string;
}

/** Nom affiché « Prénom Nom ». */
export function nomComplet(prenom: string | null | undefined, nom: string | null | undefined): string {
  return `${prenom ?? ''} ${nom ?? ''}`.replace(/\s+/g, ' ').trim();
}

/**
 * Cibles possibles : soi-même (reprise des clients) puis les apprentis
 * actifs, par ordre alphabétique (le back refuse un apprenti désactivé).
 */
export function ciblesReaffectation(
  moi: { id: UUID; prenom?: string | null; nom?: string | null },
  apprentis: readonly LivreurResponse[] | null | undefined,
): CibleReaffectation[] {
  const actifs = (apprentis ?? [])
    .filter((a) => a.actif !== false)
    .map((a) => ({ id: a.id, label: nomComplet(a.prenom, a.nom) || a.username, hint: 'Apprenti' }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
  return [{ id: moi.id, label: `Moi (${nomComplet(moi.prenom, moi.nom) || 'livreur principal'})`, hint: 'Livreur principal' }, ...actifs];
}

/** Livreur actuel d'un client (« Moi » pour le principal), vide si inconnu. */
export function livreurDuClient(client: ClientResponse, moiId: UUID): string {
  const l = client.livreur;
  if (!l) return '';
  return l.id === moiId ? 'Moi' : nomComplet(l.prenom, l.nom);
}

/** Clients de l'équipe triés par nom, filtrés par la recherche (nom, quartier, contact, livreur). */
export function clientsAffiches(
  clients: readonly ClientResponse[] | null | undefined,
  recherche: string,
  moiId: UUID,
): ClientResponse[] {
  const tries = [...(clients ?? [])].sort((a, b) =>
    nomComplet(a.prenom, a.nom).localeCompare(nomComplet(b.prenom, b.nom), 'fr', { sensitivity: 'base' }),
  );
  return filtrerRecherche(tries, recherche, (c) => [
    nomComplet(c.prenom, c.nom),
    c.quartier?.libelle,
    c.contact,
    livreurDuClient(c, moiId),
  ]);
}

/**
 * Demande envoyée au back, ou le message du refus local (mêmes règles que le
 * back : clients ou zone, puis une cible).
 */
export function demandeReaffectation(
  mode: ModeReaffectation,
  clientIds: readonly UUID[],
  zoneId: UUID | null,
  livreurId: UUID | null,
): { demande: ReaffecterClientsEquipeRequest } | { erreur: string } {
  if (mode === 'selection' ? clientIds.length === 0 : !zoneId) return { erreur: MESSAGE_SANS_CLIENT_NI_ZONE };
  if (!livreurId) return { erreur: MESSAGE_SANS_CIBLE };
  return {
    demande: mode === 'zone' ? { zoneId: zoneId as UUID, livreurId } : { clientIds: [...clientIds], livreurId },
  };
}

/** Message de fin : « 3 clients réaffectés. » / « Aucun client à déplacer… ». */
export function messageResultat(reaffectes: number): string {
  if (reaffectes <= 0) return 'Aucun client à déplacer : ils sont déjà chez ce livreur.';
  return `${reaffectes} client${reaffectes > 1 ? 's' : ''} réaffecté${reaffectes > 1 ? 's' : ''}.`;
}
