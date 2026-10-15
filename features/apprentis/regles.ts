import type { DemandeReinitialisationResponse, UUID } from '../../types/api';

/**
 * M1 : règles des demandes « Mot de passe oublié » vues par leur
 * destinataire (livreur principal pour ses apprentis, responsable pour ses
 * commerciaux).
 */

export const BADGE_MOT_DE_PASSE_DEMANDE = 'Mot de passe demandé';

/** Demande en attente seulement (la liste du back n'a en principe que celles-là). */
export function estEnAttente(d: Pick<DemandeReinitialisationResponse, 'statut'>): boolean {
  return !d.statut || d.statut === 'EN_ATTENTE';
}

/** Ids des comptes qui ont une demande en attente. */
export function comptesAvecDemande(demandes: readonly DemandeReinitialisationResponse[] | undefined): Set<UUID> {
  return new Set((demandes ?? []).filter(estEnAttente).map((d) => d.compteId));
}

/** Nombre de demandes en attente (ligne « À traiter », pastille de la cloche). */
export function nbDemandesMotDePasse(demandes: readonly DemandeReinitialisationResponse[] | undefined): number {
  return (demandes ?? []).filter(estEnAttente).length;
}

/** Libellé de la ligne « À traiter ». */
export function libelleDemandesMotDePasse(n: number): string {
  return `${n} demande${n > 1 ? 's' : ''} de mot de passe`;
}
