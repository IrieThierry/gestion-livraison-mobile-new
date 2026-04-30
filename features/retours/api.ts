import { apiClient } from '../../lib/api-client';
import type {
  LivraisonResponse,
  ModifierLivraisonRequest,
  ProduitLivraisonRequest,
  ProduitLivraisonResponse,
  UUID,
} from '../../types/api';

/**
 * Représente une ligne à incrémenter en retour : pour chaque
 * `produitLivraisonId` (id de la `ProduitLivraisonResponse` existante),
 * on indique combien d'unités le client rapporte.
 *
 * Côté back : la quantité est ajoutée à `qteRetournee` du
 * ProduitLivraison correspondant ; le stock courant du livreur est
 * ré-incrémenté et le solde du client est déduit (
 * `ModifierLivraisonUseCase` orchestre le tout dans une transaction).
 */
export interface LigneRetour {
  produitLivraisonId: UUID;
  quantite: number;
}

export interface CreerRetourClientRequest {
  livraisonId: UUID;
  lignes: LigneRetour[];
}

/**
 * Construit le payload `ModifierLivraisonRequest` complet à partir de
 * la livraison source et des lignes à retourner.
 *
 * Le back attend toutes les lignes (pas un patch) : on remappe les
 * `ProduitLivraisonResponse` (champs `qteLivre` / `qteRetourne`) en
 * `ProduitLivraisonRequest` (`qteLivree` / `qteRetournee`) et on
 * additionne la quantité à retourner sur la ligne ciblée.
 */
function buildModifierPayload(
  livraison: LivraisonResponse,
  request: CreerRetourClientRequest,
): ModifierLivraisonRequest {
  const deltaParLigne = new Map<UUID, number>();
  for (const ligne of request.lignes) {
    deltaParLigne.set(
      ligne.produitLivraisonId,
      (deltaParLigne.get(ligne.produitLivraisonId) ?? 0) + ligne.quantite,
    );
  }

  const produitsLivraison: ProduitLivraisonRequest[] = (
    livraison.produitsLivraison ?? []
  ).map((p: ProduitLivraisonResponse) => ({
    produitId: p.produit.id,
    qteLivree: p.qteLivre,
    qteRetournee: (p.qteRetourne ?? 0) + (deltaParLigne.get(p.id) ?? 0),
    prixDeVente: p.prixDeVente,
  }));

  return {
    id: livraison.id,
    livreurId: livraison.livreur.id,
    clientId: livraison.client.id,
    produitsLivraison,
    avecRemise: livraison.avecRemise,
  };
}

/**
 * API retour client mobile.
 *
 * Le portail web n'a pas (encore) de feature `retours` dédiée — les
 * retours s'enregistrent via la page de modification d'une livraison
 * (`PUT /livraison`). On encapsule ici l'idiome pour l'app mobile :
 * l'appelant fournit la livraison source + les quantités à rapporter,
 * et on s'occupe de construire le `ModifierLivraisonRequest` complet.
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
