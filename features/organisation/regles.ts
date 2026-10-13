import type {
  AuthResponse,
  CreerDemandeChargementRequest,
  DemandeChargementResponse,
  StatutDemandeChargement,
  UUID,
} from '../../types/api';

/**
 * Organisation B2B côté mobile (spec 2026-10-13, O4, O6, O8) : rôle de
 * l'utilisateur dans son organisation, vocabulaire de l'interface, prix
 * imposés et demandes de chargement. Fonctions pures.
 */

type UtilisateurOrganisation = Pick<AuthResponse, 'organisationId' | 'organisationRole'> | null | undefined;

/** Responsable ou commercial d'une organisation (ancienne session sans les champs : non). */
export function estMembreOrganisation(user: UtilisateurOrganisation): boolean {
  return (
    !!user?.organisationId &&
    (user.organisationRole === 'RESPONSABLE' || user.organisationRole === 'COMMERCIAL')
  );
}

/** Commercial d'une organisation : il vend aux prix imposés et reçoit des factures. */
export function estCommercial(user: UtilisateurOrganisation): boolean {
  return estMembreOrganisation(user) && user?.organisationRole === 'COMMERCIAL';
}

/** Responsable d'une organisation (ne vend pas, son stock est le dépôt). */
export function estResponsable(user: UtilisateurOrganisation): boolean {
  return estMembreOrganisation(user) && user?.organisationRole === 'RESPONSABLE';
}

export interface Vocabulaire {
  /** « Commercial » / « Apprenti ». */
  Apprenti: string;
  /** « commercial » / « apprenti ». */
  apprenti: string;
  /** « commerciaux » / « apprentis ». */
  apprentis: string;
  /** « Mes commerciaux » / « Mes apprentis ». */
  mesApprentis: string;
  /** « Responsable » / « Livreur principal ». */
  Principal: string;
  /** « ton responsable » / « ton livreur principal ». */
  tonPrincipal: string;
  /** « ton responsable » / « ton principal » (remises d'argent). */
  tonPrincipalCourt: string;
  /** Action « rendre » de l'apprenti : « Rendre au dépôt » / « Rendre du stock ». */
  rendreStock: string;
  /** Aide de l'action « rendre ». */
  rendreStockAide: string;
  /** Rôle affiché sur le profil : « Commercial », « Responsable », null hors organisation. */
  role: string | null;
}

/** O4 : on dit « Commercial » et « Responsable » quand l'utilisateur appartient à une organisation. */
export function vocabulaire(user: UtilisateurOrganisation): Vocabulaire {
  if (estMembreOrganisation(user)) {
    return {
      Apprenti: 'Commercial',
      apprenti: 'commercial',
      apprentis: 'commerciaux',
      mesApprentis: 'Mes commerciaux',
      Principal: 'Responsable',
      tonPrincipal: 'ton responsable',
      tonPrincipalCourt: 'ton responsable',
      rendreStock: 'Rendre au dépôt',
      rendreStockAide: 'Au dépôt de ton responsable, qui devra l’accepter',
      role: user?.organisationRole === 'RESPONSABLE' ? 'Responsable' : 'Commercial',
    };
  }
  return {
    Apprenti: 'Apprenti',
    apprenti: 'apprenti',
    apprentis: 'apprentis',
    mesApprentis: 'Mes apprentis',
    Principal: 'Livreur principal',
    tonPrincipal: 'ton livreur principal',
    tonPrincipalCourt: 'ton principal',
    rendreStock: 'Rendre du stock',
    rendreStockAide: 'À ton livreur principal, qui devra l’accepter',
    role: null,
  };
}

// ---------------------------------------------------------------------------
// O6 : prix imposés
// ---------------------------------------------------------------------------

/** Message de la spec quand aucun prix n'est fixé pour un produit. */
export function messageAucunPrix(designation: string): string {
  return `Aucun prix fixé pour ${designation} : contactez votre responsable.`;
}

export const MESSAGE_PRIX_EN_LECTURE = 'Prix en cours de lecture…';

/** Lecture du prix en échec (réseau, erreur serveur) : distinct de « aucun prix fixé ». */
export function messagePrixIndisponible(designation: string): string {
  return `Prix de ${designation} indisponible : vérifie ta connexion puis réessaie.`;
}

/**
 * Vente d'un commercial : chaque ligne vendue doit avoir un prix lu et fixé
 * par le responsable (prix résolu > 0). Renvoie, pour la première ligne en
 * défaut : « Prix en cours de lecture… », le message de prix indisponible
 * (lecture en échec) ou le message de la spec (aucun prix fixé) ; sinon null.
 */
export function erreurPrixImposes(
  lignes: ReadonlyArray<{
    designation: string;
    prix: number;
    qte: number;
    prixStatut?: 'en-lecture' | 'erreur' | 'resolu';
  }>,
): string | null {
  const vendues = lignes.filter((l) => l.qte > 0);
  if (vendues.some((l) => l.prixStatut === 'en-lecture')) return MESSAGE_PRIX_EN_LECTURE;
  const enEchec = vendues.find((l) => l.prixStatut === 'erreur');
  if (enEchec) return messagePrixIndisponible(enEchec.designation);
  const sansPrix = vendues.find((l) => !(l.prix > 0));
  return sansPrix ? messageAucunPrix(sansPrix.designation) : null;
}

// ---------------------------------------------------------------------------
// O8 : demandes de chargement
// ---------------------------------------------------------------------------

/** Ligne saisie dans le formulaire de demande de chargement. */
export interface LigneDemandeSaisie {
  produitId: UUID;
  designation: string;
  qte: number;
}

export const MESSAGE_DEMANDE_VIDE = 'Une demande de chargement doit contenir au moins un produit.';

/** Erreur bloquante de la demande saisie, ou null. */
export function erreurDemandeChargement(lignes: ReadonlyArray<LigneDemandeSaisie>): string | null {
  return lignes.some((l) => l.qte > 0) ? null : MESSAGE_DEMANDE_VIDE;
}

/** Payload `POST /organisation/me/demandes-chargement` : lignes à quantité > 0. */
export function payloadDemandeChargement(lignes: ReadonlyArray<LigneDemandeSaisie>): CreerDemandeChargementRequest {
  return {
    lignes: lignes.filter((l) => l.qte > 0).map((l) => ({ produitId: l.produitId, quantite: l.qte })),
  };
}

const LIBELLES_STATUT: Record<StatutDemandeChargement, string> = {
  EN_ATTENTE: 'En attente',
  SERVIE: 'Servie',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

export function libelleStatutDemande(statut: StatutDemandeChargement): string {
  return LIBELLES_STATUT[statut] ?? statut;
}

/** Le commercial annule sa demande tant qu'elle est en attente. */
export function peutAnnulerDemande(d: Pick<DemandeChargementResponse, 'statut'>): boolean {
  return d.statut === 'EN_ATTENTE';
}

/**
 * P7 : bon(s) de transfert créé(s) au service d'une demande, sans doublon,
 * dans l'ordre des lignes. Une demande servie n'en a qu'un (porté par toutes
 * les lignes servies) ; une ligne servie à 0 n'en a pas.
 */
export function bonsServis(
  d: Pick<DemandeChargementResponse, 'lignes'>,
): { transfertId: string; statut: NonNullable<DemandeChargementResponse['lignes'][number]['statutTransfert']> }[] {
  const bons = new Map<string, NonNullable<DemandeChargementResponse['lignes'][number]['statutTransfert']>>();
  for (const l of d.lignes ?? []) {
    if (l.transfertId && l.statutTransfert && !bons.has(l.transfertId)) bons.set(l.transfertId, l.statutTransfert);
  }
  return Array.from(bons, ([transfertId, statut]) => ({ transfertId, statut }));
}
