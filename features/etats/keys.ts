import type { UUID } from '../../types/api';
import type { CibleLecture } from './acces';
import type { Periode } from './calculs/commun';

const cle = (c: CibleLecture) => (c.mode === 'equipe' ? `equipe:${c.parentId}` : c.livreurId);
const per = (p: Periode | null) => (p ? `${p.debut}..${p.fin}` : 'aucune');

// Clés des lectures des états (sous `['etats']`, sans écriture à invalider).
export const etatsKeys = {
  all: ['etats'] as const,
  livraisons: (c: CibleLecture, p: Periode | null) =>
    [...etatsKeys.all, 'livraisons', cle(c), per(p)] as const,
  encaissements: (c: CibleLecture) => [...etatsKeys.all, 'encaissements', cle(c)] as const,
  encours: (c: CibleLecture) => [...etatsKeys.all, 'encours', cle(c)] as const,
  stockLivreur: (livreurId: UUID) => [...etatsKeys.all, 'stock', livreurId] as const,
  stockEquipe: () => [...etatsKeys.all, 'stock', 'equipe'] as const,
  mouvements: (livreurId: UUID, p: Periode | null) =>
    [...etatsKeys.all, 'mouvements', livreurId, per(p)] as const,
  partenaires: () => [...etatsKeys.all, 'partenaires'] as const,
  commandes: () => [...etatsKeys.all, 'commandes'] as const,
  versements: (livreurId: UUID, p: Periode | null) =>
    [...etatsKeys.all, 'versements', livreurId, per(p)] as const,
};
