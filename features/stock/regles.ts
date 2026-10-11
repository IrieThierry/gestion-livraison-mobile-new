import type {
  MiseAZeroStockRequest,
  MotifAjustementStock,
  MouvementStockResponse,
  TypeMouvementStock,
  UUID,
} from '../../types/api';

const LIBELLES: Record<TypeMouvementStock, string> = {
  RECEPTION: 'Réception',
  TRANSFERT_ENTREE: 'Transfert reçu',
  TRANSFERT_SORTIE: 'Transfert envoyé',
  LIVRAISON: 'Livraison',
  RETOUR_EN_STOCK: 'Retour en stock',
  AJUSTEMENT: 'Ajustement',
};

/** Libellé d'un type de mouvement de stock (mêmes libellés que le web). */
export function libelleTypeMouvement(type: TypeMouvementStock): string {
  return LIBELLES[type] ?? type;
}

/** Quantité signée affichée : « +25 », « −5 » (vrai signe moins), « 0 ». */
export function libelleQuantiteMouvement(m: Pick<MouvementStockResponse, 'quantite'>): string {
  if (m.quantite > 0) return `+${m.quantite}`;
  if (m.quantite < 0) return `\u2212${Math.abs(m.quantite)}`;
  return '0';
}

// ---------- Mise à zéro du stock d'un produit (G7, G9) ----------

/** Motifs proposés, dans l'ordre d'affichage, avec les libellés du back. */
export const MOTIFS_AJUSTEMENT: ReadonlyArray<{ id: MotifAjustementStock; label: string }> = [
  { id: 'PERTE', label: 'Perte' },
  { id: 'PERIME', label: 'Périmé' },
  { id: 'CASSE', label: 'Casse' },
  { id: 'INVENTAIRE', label: 'Inventaire' },
  { id: 'AUTRE', label: 'Autre' },
];

export const COMMENTAIRE_AJUSTEMENT_MAX = 500;

/** Messages identiques à ceux du back. */
export const MESSAGES_MISE_A_ZERO = {
  motif: 'Choisissez un motif.',
  commentaireAutre: 'Précisez le motif dans le commentaire.',
  commentaireTropLong: `Le commentaire ne doit pas dépasser ${COMMENTAIRE_AJUSTEMENT_MAX} caractères.`,
  dejaAZero: 'Le stock de ce produit est déjà à zéro.',
} as const;

export type ResultatMiseAZero =
  | { ok: true; valeur: MiseAZeroStockRequest }
  | { ok: false; erreur: string };

/**
 * Valide la saisie de la fenêtre « Mettre à zéro » et construit le corps :
 * quantité > 0, motif choisi, commentaire exigé pour « Autre », 500
 * caractères au plus. Le commentaire est envoyé sans ses espaces, et omis
 * s'il est vide.
 */
export function construireMiseAZero(saisie: {
  quantite: number;
  motif: MotifAjustementStock | null;
  commentaire: string;
}): ResultatMiseAZero {
  if (!(saisie.quantite > 0)) return { ok: false, erreur: MESSAGES_MISE_A_ZERO.dejaAZero };
  if (!saisie.motif || !MOTIFS_AJUSTEMENT.some((m) => m.id === saisie.motif)) {
    return { ok: false, erreur: MESSAGES_MISE_A_ZERO.motif };
  }
  const commentaire = saisie.commentaire.trim();
  if (saisie.motif === 'AUTRE' && !commentaire) {
    return { ok: false, erreur: MESSAGES_MISE_A_ZERO.commentaireAutre };
  }
  if (commentaire.length > COMMENTAIRE_AJUSTEMENT_MAX) {
    return { ok: false, erreur: MESSAGES_MISE_A_ZERO.commentaireTropLong };
  }
  return {
    ok: true,
    valeur: commentaire ? { motif: saisie.motif, commentaire } : { motif: saisie.motif },
  };
}

/**
 * Visibilité de l'action « Mettre à zéro » : réservée au livreur principal
 * (sans parent), sur son propre stock ou celui d'un de ses apprentis. Un
 * apprenti ne la voit jamais.
 */
export function peutMettreAZero(
  utilisateur: { id: UUID; parentId?: UUID | null } | null | undefined,
  livreurCibleId: UUID | null | undefined,
  apprentiIds: ReadonlyArray<UUID> = [],
): boolean {
  if (!utilisateur || utilisateur.parentId || !livreurCibleId) return false;
  return livreurCibleId === utilisateur.id || apprentiIds.includes(livreurCibleId);
}
