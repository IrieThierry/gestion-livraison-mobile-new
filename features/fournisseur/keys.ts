import type { StatutDemandeModif, UUID } from '../../types/api';

/** Clés de cache de l'espace fournisseur (mêmes racines que le portail web). */
export const fournisseurKeys = {
  all: ['fournisseur-me'] as const,
  profil: () => [...fournisseurKeys.all, 'profil'] as const,
  synthese: (mois: string) => [...fournisseurKeys.all, 'synthese', mois] as const,
  reversementsSynthese: (mois: string) => [...fournisseurKeys.all, 'reversements-synthese', mois] as const,
  commandes: () => [...fournisseurKeys.all, 'commandes'] as const,
  /** Livreurs partenaires (dû, remise, blocage) ; les lectures par livreur sont sous cette clé. */
  partenaires: () => [...fournisseurKeys.all, 'partenaires'] as const,
  commandesLivreur: (livreurId: UUID) => [...fournisseurKeys.partenaires(), 'commandes', livreurId] as const,
  prixParticuliersLivreur: (livreurId: UUID) =>
    [...fournisseurKeys.partenaires(), 'prix-particuliers', livreurId] as const,
  /** Situation d'un versement (livreur, commandes cochées triées). */
  situationVersement: (livreurId: UUID, cle: string) =>
    [...fournisseurKeys.all, 'versement-situation', livreurId, cle] as const,
  invitations: () => [...fournisseurKeys.all, 'invitations'] as const,
  /** Sous la clé des invitations : invalider la liste rafraîchit aussi le compteur. */
  compteInvitations: () => [...fournisseurKeys.invitations(), 'compte'] as const,
  /** Toutes les listes de demandes (en attente pour le badge, toutes pour l'écran). */
  demandesModifRacine: () => [...fournisseurKeys.all, 'demandes-modif-versement'] as const,
  demandesModif: (statut?: StatutDemandeModif) =>
    [...fournisseurKeys.demandesModifRacine(), statut ?? 'tous'] as const,
  /** FM3 : versements reçus d'un mois (ou de toutes les périodes). */
  versements: (mois?: string) => [...fournisseurKeys.all, 'versements', mois ?? 'all'] as const,
  reversements: () => [...fournisseurKeys.all, 'reversements'] as const,
  catalogue: () => [...fournisseurKeys.all, 'catalogue'] as const,
};
