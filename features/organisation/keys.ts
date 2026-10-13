import type { FiltresDocumentsVente, UUID } from '../../types/api';

export const organisationKeys = {
  all: ['organisation'] as const,
  moi: () => [...organisationKeys.all, 'moi'] as const,
  demandes: () => [...organisationKeys.all, 'demandes'] as const,
  factures: (filtres: FiltresDocumentsVente) => [...organisationKeys.all, 'factures', filtres] as const,
  avoirs: (filtres: FiltresDocumentsVente) => [...organisationKeys.all, 'avoirs', filtres] as const,
  facture: (id: UUID) => [...organisationKeys.all, 'facture', id] as const,
  grillePrix: () => [...organisationKeys.all, 'grille-prix'] as const,
  /** Préfixe de tous les tableaux de bord (relus après une décision sur un transfert ou une remise). */
  tableauxDeBord: () => [...organisationKeys.all, 'tableau-de-bord'] as const,
  tableauDeBord: (date: string) => [...organisationKeys.tableauxDeBord(), date] as const,
};
