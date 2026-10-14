import { apiClient } from '../../lib/api-client';
import type {
  CommandeResponse,
  DepenseResponse,
  EncaissementLivraisonResponse,
  EncoursClientResponse,
  FournisseurAvecRelation,
  LivraisonResponse,
  MouvementStockResponse,
  StockEquipeLigneResponse,
  StockLivreurResponse,
  UUID,
  VersementResponse,
} from '../../types/api';
import type { CibleLecture } from './acces';
import type { Periode } from './calculs/commun';

const get = async <T>(url: string, params?: Record<string, string>): Promise<T> =>
  (await apiClient.get<T>(url, params ? { params } : undefined)).data;

/**
 * Lectures des états (routes existantes, filtres de période `debut`/`fin` en
 * jours entiers quand le back les propose). Aucune écriture.
 */
export const etatsApi = {
  /** Livraisons du livreur, ou de l'équipe d'un principal, sur la période. */
  livraisons: (cible: CibleLecture, p: Periode): Promise<LivraisonResponse[]> =>
    cible.mode === 'equipe'
      ? get(`/livraison/parent/${cible.parentId}`, { debut: p.debut, fin: p.fin })
      : get(`/livraison/livraison-livreur/${cible.livreurId}`, { debut: p.debut, fin: p.fin }),

  /** Tous les encaissements (pas de filtre de période côté back : filtrés sur `dateEncaissement`). */
  encaissements: (cible: CibleLecture): Promise<EncaissementLivraisonResponse[]> =>
    cible.mode === 'equipe'
      ? get(`/encaissement/livraison/parent/${cible.parentId}`)
      : get(`/encaissement/livraison/livreur/${cible.livreurId}`),

  /** Soldes actuels des clients. */
  encours: (cible: CibleLecture): Promise<EncoursClientResponse[]> =>
    cible.mode === 'equipe'
      ? get(`/client/encours/parent/${cible.parentId}`)
      : get(`/client/encours/livreur/${cible.livreurId}`),

  /** Stock courant d'un livreur. */
  stockLivreur: (livreurId: UUID): Promise<StockLivreurResponse[]> =>
    get(`/stock-livreur/${livreurId}/actuel`),

  /** Stock courant de l'équipe du principal connecté. */
  stockEquipe: (): Promise<StockEquipeLigneResponse[]> => get('/stock-livreur/equipe'),

  /** Mouvements de stock d'un livreur sur la période. */
  mouvements: (livreurId: UUID, p: Periode): Promise<MouvementStockResponse[]> =>
    get(`/stock-livreur/${livreurId}/historique`, { debut: p.debut, fin: p.fin }),

  /** Fournisseurs partenaires avec le dû et la remise à recevoir (principal). */
  partenaires: (): Promise<FournisseurAvecRelation[]> => get('/livreur/me/fournisseurs'),

  /**
   * Toutes les commandes du livreur connecté : les réceptions d'une commande
   * passée avant la période peuvent tomber dans la période.
   */
  commandes: (): Promise<CommandeResponse[]> => get('/commande/me'),

  /** Versements du livreur sur la période. */
  versements: (livreurId: UUID, p: Periode): Promise<VersementResponse[]> =>
    get(`/versement/livreur/${livreurId}`, { debut: p.debut, fin: p.fin }),

  /**
   * Dépenses de la période (jours inclus). Sans filtre : celles de
   * l'utilisateur connecté. S5 : `equipe` (principal et apprentis) ou
   * `livreurId` (un apprenti), livreur principal indépendant seulement.
   */
  depenses: (p: Periode, filtre: { livreurId?: UUID; equipe?: boolean } = {}): Promise<DepenseResponse[]> =>
    get('/depense', {
      startDate: p.debut,
      endDate: p.fin,
      ...(filtre.equipe ? { equipe: 'true' } : filtre.livreurId ? { livreurId: filtre.livreurId } : {}),
    }),
};
