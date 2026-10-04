import { apiClient } from '../../lib/api-client';
import type {
  LivraisonResponse,
  ModifierLivraisonRequest,
  ProduitLivraisonRequest,
  ProduitLivraisonResponse,
  UUID,
} from '../../types/api';

/**
 * Une ligne à incrémenter en retour : pour chaque `produitLivraisonId` (id de
 * la `ProduitLivraisonResponse` existante), combien d'unités le client
 * rapporte, et ce que le livreur en fait :
 *  - `remettreEnStock: true` : les unités reviennent dans son stock
 *    (`qteRetourneeEnStock` augmente d'autant, le back ré-incrémente le stock) ;
 *  - `remettreEnStock: false` : les unités sont perdues (invendables), le
 *    stock ne bouge pas.
 * Dans les deux cas le dû du client baisse de (prix + remise) × quantité.
 */
export interface LigneRetour {
  produitLivraisonId: UUID;
  quantite: number;
  remettreEnStock: boolean;
}

export interface CreerRetourClientRequest {
  livraisonId: UUID;
  lignes: LigneRetour[];
}

/** Valeur d'un retour, même formule que le back : (prix + remise unitaire) × quantité. */
export function valeurRetour(
  p: Pick<ProduitLivraisonResponse, 'prixDeVente' | 'remiseUnitaire'>,
  quantite: number,
): number {
  return ((Number(p.prixDeVente) || 0) + (Number(p.remiseUnitaire) || 0)) * (Number(quantite) || 0);
}

/** Quantité encore retournable sur une ligne. */
export function qteRetournable(p: Pick<ProduitLivraisonResponse, 'qteLivre' | 'qteRetourne'>): number {
  return Math.max(0, (p.qteLivre ?? 0) - (p.qteRetourne ?? 0));
}

/**
 * Construit le payload `ModifierLivraisonRequest` complet (le back attend
 * toutes les lignes, pas un patch) à partir de la livraison source et des
 * lignes à retourner.
 *
 * Chaque ligne renvoie ses valeurs existantes (`qteLivree`, `prixDeVente`,
 * `qteRetournee`, `qteRetourneeEnStock`) : `qteRetourneeEnStock` est TOUJOURS
 * explicite pour ne jamais dépendre d'une valeur par défaut côté back. Sur la
 * ligne ciblée, `qteRetournee` augmente de la quantité retournée et
 * `qteRetourneeEnStock` de la part remise en stock.
 */
export function buildModifierPayload(
  livraison: LivraisonResponse,
  request: CreerRetourClientRequest,
): ModifierLivraisonRequest {
  const retourParLigne = new Map<UUID, number>();
  const enStockParLigne = new Map<UUID, number>();
  for (const ligne of request.lignes) {
    const q = Math.max(0, Math.trunc(ligne.quantite || 0));
    retourParLigne.set(ligne.produitLivraisonId, (retourParLigne.get(ligne.produitLivraisonId) ?? 0) + q);
    if (ligne.remettreEnStock) {
      enStockParLigne.set(
        ligne.produitLivraisonId,
        (enStockParLigne.get(ligne.produitLivraisonId) ?? 0) + q,
      );
    }
  }

  const produitsLivraison: ProduitLivraisonRequest[] = (livraison.produitsLivraison ?? []).map(
    (p: ProduitLivraisonResponse) => ({
      produitId: p.produit.id,
      qteLivree: p.qteLivre,
      qteRetournee: (p.qteRetourne ?? 0) + (retourParLigne.get(p.id) ?? 0),
      qteRetourneeEnStock: (p.qteRetourneeEnStock ?? 0) + (enStockParLigne.get(p.id) ?? 0),
      prixDeVente: p.prixDeVente,
      memoriserPrixClient: false,
    }),
  );

  return {
    id: livraison.id,
    livreurId: livraison.livreur.id,
    clientId: livraison.client.id,
    produitsLivraison,
    avecRemise: livraison.avecRemise,
  };
}

/**
 * API retour client mobile : un retour est une modification de la livraison
 * source (`PUT /livraison`, `ModifierLivraisonUseCase`), autorisée même sur
 * une livraison entièrement payée (seuls les retours y sont modifiables).
 */
export const retoursApi = {
  enregistrer: async (
    livraison: LivraisonResponse,
    request: CreerRetourClientRequest,
  ): Promise<LivraisonResponse> => {
    const payload = buildModifierPayload(livraison, request);
    const { data } = await apiClient.put<LivraisonResponse>('/livraison', payload);
    return data;
  },
};
