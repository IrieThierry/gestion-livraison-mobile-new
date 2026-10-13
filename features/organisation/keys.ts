import type { FiltresDocumentsVente, UUID } from '../../types/api';

export const organisationKeys = {
  all: ['organisation'] as const,
  moi: () => [...organisationKeys.all, 'moi'] as const,
  demandes: () => [...organisationKeys.all, 'demandes'] as const,
  factures: (filtres: FiltresDocumentsVente) => [...organisationKeys.all, 'factures', filtres] as const,
  avoirs: (filtres: FiltresDocumentsVente) => [...organisationKeys.all, 'avoirs', filtres] as const,
  facture: (id: UUID) => [...organisationKeys.all, 'facture', id] as const,
};
