import { apiClient } from '../../lib/api-client';
import type {
  EnregistrerRetourRequest,
  EnregistrerRetourResponse,
  FiltresRetours,
  PageRetoursResponse,
  ProduitLivraisonResponse,
} from '../../types/api';

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

function jour(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

/** Mois en cours, du 1er à aujourd'hui, en `yyyy-MM-dd` (jours inclus côté back). */
export function moisEnCours(now: Date = new Date()): { debut: string; fin: string } {
  return { debut: jour(new Date(now.getFullYear(), now.getMonth(), 1)), fin: jour(now) };
}

/** Les `jours` derniers jours, aujourd'hui compris, en `yyyy-MM-dd`. */
export function derniersJours(jours: number, now: Date = new Date()): { debut: string; fin: string } {
  return { debut: jour(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (jours - 1))), fin: jour(now) };
}

/**
 * API retours : lecture du journal (`GET /retour`, page à partir de 0) et
 * saisie d'un retour (`POST /retour`) sans modifier la livraison.
 */
export const retoursApi = {
  lister: async (params: FiltresRetours): Promise<PageRetoursResponse> => {
    const { data } = await apiClient.get<PageRetoursResponse>('/retour', { params });
    return data;
  },
  enregistrer: async (payload: EnregistrerRetourRequest): Promise<EnregistrerRetourResponse> => {
    const { data } = await apiClient.post<EnregistrerRetourResponse>('/retour', payload);
    return data;
  },
};
