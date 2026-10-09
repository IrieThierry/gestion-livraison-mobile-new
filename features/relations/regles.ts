import type { FournisseurAvecRelation } from '../../types/api';

/** État affiché pour un fournisseur dans « Mes fournisseurs ». */
export type EtatRelation = 'NON_INVITE' | 'ENVOYEE' | 'ACCEPTE' | 'REFUSE' | 'BLOQUE';

export type ActionRelation = 'inviter' | 'annuler' | 'reinviter';

export const LIBELLES_ETAT: Record<EtatRelation, string> = {
  NON_INVITE: 'Non invité',
  ENVOYEE: 'Invitation envoyée',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  BLOQUE: 'Bloqué',
};

export const LIBELLES_ACTION: Record<ActionRelation, string> = {
  inviter: 'Inviter',
  annuler: "Annuler l'invitation",
  reinviter: 'Réinviter',
};

export const MESSAGE_AUCUN_PARTENAIRE =
  'Aucun fournisseur partenaire. Invitez un fournisseur depuis « Mes fournisseurs ».';

/**
 * État d'un fournisseur pour le livreur. Un blocage l'emporte sur tout le reste
 * (même avec une relation acceptée). Une invitation annulée vaut « non invité ».
 */
export function etatRelation(f: Pick<FournisseurAvecRelation, 'relation' | 'bloque'>): EtatRelation {
  if (f.bloque) return 'BLOQUE';
  switch (f.relation?.statut) {
    case 'EN_ATTENTE':
      return 'ENVOYEE';
    case 'ACCEPTEE':
      return 'ACCEPTE';
    case 'REFUSEE':
      return 'REFUSE';
    default:
      return 'NON_INVITE';
  }
}

/**
 * Action proposée selon l'état. Rien pour un apprenti (lecture seule), un
 * fournisseur accepté ou un fournisseur bloqué. Le back reste l'arbitre.
 */
export function actionPermise(etat: EtatRelation, estPrincipal: boolean): ActionRelation | null {
  if (!estPrincipal) return null;
  switch (etat) {
    case 'NON_INVITE':
      return 'inviter';
    case 'ENVOYEE':
      return 'annuler';
    case 'REFUSE':
      return 'reinviter';
    default:
      return null;
  }
}

export const MESSAGE_ENTETE_APPRENTI =
  'Fournisseurs de votre livreur principal. Seul le livreur principal peut inviter un fournisseur.';

export const MESSAGES_ECHEC: Record<'inviter' | 'annuler' | 'reinviter', string> = {
  inviter: "Impossible d'envoyer l'invitation",
  reinviter: "Impossible d'envoyer l'invitation",
  annuler: "Impossible d'annuler l'invitation",
};

export type EtatListePartenaires = 'chargement' | 'erreur' | 'vide' | 'liste';

/**
 * Ce que « Nouvelle commande » affiche pour la liste des partenaires. L'état
 * vide n'est atteint que si la requête a réussi : une erreur reste une erreur.
 */
export function etatListePartenaires(q: {
  isLoading: boolean;
  isError: boolean;
  nombre: number;
}): EtatListePartenaires {
  if (q.isLoading) return 'chargement';
  if (q.isError) return 'erreur';
  return q.nombre === 0 ? 'vide' : 'liste';
}
