import type { StatutDemandeModif } from '../../types/api';

/** Clés de cache de l'espace fournisseur (mêmes racines que le portail web). */
export const fournisseurKeys = {
  all: ['fournisseur-me'] as const,
  profil: () => [...fournisseurKeys.all, 'profil'] as const,
  synthese: (mois: string) => [...fournisseurKeys.all, 'synthese', mois] as const,
  reversementsSynthese: (mois: string) => [...fournisseurKeys.all, 'reversements-synthese', mois] as const,
  commandes: () => [...fournisseurKeys.all, 'commandes'] as const,
  /** Livreurs partenaires (dû, remise, blocage) ; les lectures par livreur sont sous cette clé. */
  partenaires: () => [...fournisseurKeys.all, 'partenaires'] as const,
  invitations: () => [...fournisseurKeys.all, 'invitations'] as const,
  /** Sous la clé des invitations : invalider la liste rafraîchit aussi le compteur. */
  compteInvitations: () => [...fournisseurKeys.invitations(), 'compte'] as const,
  demandesModif: (statut?: StatutDemandeModif) =>
    [...fournisseurKeys.all, 'demandes-modif-versement', statut ?? 'tous'] as const,
};
