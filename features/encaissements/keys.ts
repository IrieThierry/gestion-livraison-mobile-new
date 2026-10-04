import type { UUID } from '../../types/api';
import type { SituationEncaissementParams } from './api';

// Query key factory pour les encaissements de livraison.
export const encaissementKeys = {
  all: ['encaissements'] as const,
  byLivreur: (livreurId: UUID) => [...encaissementKeys.all, 'by-livreur', livreurId] as const,
  situation: (p: SituationEncaissementParams) =>
    [...encaissementKeys.all, 'situation', p.livreurId, p.clientId, p.dateDebut, p.dateFin] as const,
};
