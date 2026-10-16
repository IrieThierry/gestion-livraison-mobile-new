import { apiClient } from '../../lib/api-client';
import type { Periode } from '../etats/calculs/commun';
import type {
  CommandeResponse,
  LivraisonResponse,
  PageRetoursResponse,
  RetourResponse,
  ReversementRecord,
  UUID,
} from '../../types/api';
import { DETAIL_AUCUN, detailClient, detailLivreur, periodeDuReversement, type DetailRecu } from './recuDetail';

/**
 * Lecture des données du détail du reçu au moment de l'éditer (routes
 * existantes, limitées à la période `debut` / `fin`), comme le web
 * (src/features/reversements/recu-donnees.ts, profil LIVREUR). Une erreur de
 * lecture est propagée : l'appelant édite alors le reçu avec « Détail
 * indisponible ».
 */

/** Livreur qui édite le reçu (le livreur connecté). */
export interface EditeurRecu {
  id: UUID;
  /** Défini pour un apprenti. */
  parentId: UUID | null;
}

const get = async <T>(url: string, params: Record<string, string | number>): Promise<T> =>
  (await apiClient.get<T>(url, { params })).data;

/** Taille de page maximale de `GET /retour`. */
const TAILLE_RETOURS = 200;
/** Garde-fou : au plus 50 pages (10 000 retours d'un client sur un mois). */
const PAGES_RETOURS_MAX = 50;

/** Retours du client sur la période, toutes pages (équipe du livreur, règle du back). */
async function retoursDuClient(clientId: UUID, p: Periode): Promise<RetourResponse[]> {
  const tous: RetourResponse[] = [];
  for (let page = 0; page < PAGES_RETOURS_MAX; page += 1) {
    const reponse = await get<PageRetoursResponse>('/retour', {
      clientId,
      debut: p.debut,
      fin: p.fin,
      page,
      taille: TAILLE_RETOURS,
    });
    const contenu = reponse.contenu ?? [];
    tous.push(...contenu);
    if (contenu.length === 0 || tous.length >= reponse.total) break;
  }
  return tous;
}

/** Livraisons de la période (filtrées ensuite sur le client) : racine = lui et ses apprentis ; apprenti = lui seul. */
function livraisonsDeLaPeriode(editeur: EditeurRecu, p: Periode): Promise<LivraisonResponse[]> {
  const periode = { debut: p.debut, fin: p.fin };
  return editeur.parentId
    ? get(`/livraison/livraison-livreur/${editeur.id}`, periode)
    : get(`/livraison/parent/${editeur.id}`, periode);
}

/**
 * Commandes passées OU reçues (réception active) dans la période
 * (`/commande/me` avec debut / fin). Le filtre par fournisseur est réservé au
 * livreur principal (403 pour l'apprenti) : l'apprenti filtre ensuite.
 */
async function commandesDeLaPeriode(r: ReversementRecord, editeur: EditeurRecu, p: Periode): Promise<CommandeResponse[]> {
  return editeur.parentId
    ? get<CommandeResponse[]>('/commande/me', { debut: p.debut, fin: p.fin })
    : get<CommandeResponse[]>('/commande/me', { fournisseurId: r.beneficiaireId, debut: p.debut, fin: p.fin });
}

/**
 * FM3, espace fournisseur : détail d'un reversement fait à un livreur, comme le portail web
 * (`recu-donnees.ts`, profil FOURNISSEUR) : toutes les commandes de ce livreur chez lui
 * (la route n'a pas de période), filtrées ensuite sur la période. Pas de détail client.
 */
export async function chargerDetailRecuFournisseur(r: ReversementRecord): Promise<DetailRecu> {
  const periode = periodeDuReversement(r);
  if (!periode) return DETAIL_AUCUN;
  if (r.type === 'CLIENT') throw new Error('Détail client non lisible depuis l’espace fournisseur');
  const commandes = r.livreurId
    ? await get<CommandeResponse[]>(`/fournisseur/me/livreurs/${r.livreurId}/commandes`, {})
    : [];
  return detailLivreur(commandes, { livreurId: null, fournisseurId: null }, periode);
}

/** Détail du reçu (« aucun » sans période). Rejette si une lecture échoue. */
export async function chargerDetailRecu(r: ReversementRecord, editeur: EditeurRecu): Promise<DetailRecu> {
  const periode = periodeDuReversement(r);
  if (!periode) return DETAIL_AUCUN;
  if (r.type === 'CLIENT') {
    const [livraisons, retours] = await Promise.all([
      livraisonsDeLaPeriode(editeur, periode),
      retoursDuClient(r.beneficiaireId, periode),
    ]);
    return detailClient(livraisons, retours, r.beneficiaireId, periode);
  }
  const commandes = await commandesDeLaPeriode(r, editeur, periode);
  return detailLivreur(commandes, { livreurId: null, fournisseurId: r.beneficiaireId }, periode);
}
