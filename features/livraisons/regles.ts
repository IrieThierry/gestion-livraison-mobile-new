import type {
  ClientResponse,
  CreerLivraisonRequest,
  LivraisonResponse,
  UUID,
} from '../../types/api';

/** Ligne saisie dans le formulaire de livraison (ProduitPicker). */
export interface LigneSaisie {
  produitId: UUID;
  designation: string;
  prix: number;
  qte: number;
  /** Le livreur a choisi de mémoriser le prix saisi pour ce client. */
  memoriserPrix?: boolean;
}

/**
 * Estimation du montant d'une ligne, même formule que le back :
 * (prix + remise unitaire) × quantité.
 */
export function montantLigneEstime(prix: number, remise: number | undefined, qte: number): number {
  return ((Number(prix) || 0) + (Number(remise) || 0)) * (Number(qte) || 0);
}

/**
 * D21 : remise unitaire appliquée à toutes les lignes = celle du client si
 * « avec remise », sinon 0 (lecture seule, appliquée par le back à l'enregistrement).
 */
export function remiseLivraison(
  client: Pick<ClientResponse, 'avecOuSansRemise' | 'remiseUnitaire'> | undefined | null,
): number {
  return client?.avecOuSansRemise === true ? Number(client.remiseUnitaire) || 0 : 0;
}

/** Estimation du total de la livraison en cours de saisie. */
export function totalLivraisonEstime(lignes: LigneSaisie[], remise: number): number {
  return lignes
    .filter((l) => l.qte > 0)
    .reduce((acc, l) => acc + montantLigneEstime(l.prix, remise, l.qte), 0);
}

/** Message d'erreur bloquant pour les lignes à livrer, ou null si valides. */
export function erreurLignesLivraison(lignes: LigneSaisie[]): string | null {
  const valides = lignes.filter((l) => l.qte > 0);
  if (valides.some((l) => !(l.prix > 0))) {
    return 'Définis un prix unitaire (> 0) pour chaque ligne.';
  }
  return null;
}

/**
 * Payload `POST /livraison`. Seules les lignes avec une quantité > 0 sont
 * envoyées. `memoriserPrixClient` est toujours explicite (le back mémorise le
 * prix dans la même transaction). D21 : `remiseUnitaire` n'est JAMAIS envoyée,
 * le back applique la remise du client (0 pour un client sans remise).
 */
export function buildCreerLivraisonPayload(input: {
  livreurId: UUID;
  client: Pick<ClientResponse, 'id' | 'avecOuSansRemise'>;
  lignes: LigneSaisie[];
  /** D14/D20 : faux pour un apprenti (le back ne mémorise rien) : memoriserPrixClient à false. */
  conditionsFixables: boolean;
  /**
   * O6 : commercial d'organisation. Le prix de chaque ligne est imposé par le
   * back (le prix envoyé, obligatoire, est ignoré : on envoie le prix résolu),
   * jamais de remise ni de mémorisation du prix client.
   */
  prixImpose?: boolean;
}): CreerLivraisonRequest {
  const avecRemise = !input.prixImpose && input.client.avecOuSansRemise === true;
  const memoriser = input.conditionsFixables && !input.prixImpose;
  return {
    livreurId: input.livreurId,
    clientId: input.client.id,
    avecRemise,
    produitsLivraison: input.lignes
      .filter((l) => l.qte > 0)
      .map((l) => ({
        produitId: l.produitId,
        qteLivree: l.qte,
        qteRetournee: 0,
        qteRetourneeEnStock: 0,
        prixDeVente: l.prix,
        memoriserPrixClient: memoriser && l.memoriserPrix === true,
      })),
  };
}

/** Retours à enregistrer sur une livraison antérieure. */
export interface RetoursParLivraison {
  livraison: LivraisonResponse;
  lignes: Array<{ produitLivraisonId: UUID; quantite: number; remettreEnStock: boolean }>;
}

/**
 * Saisie d'un retour en attente, indexée par id de ligne de livraison.
 * `enStock` : true = remettre en stock, false = perdu, null = pas encore
 * choisi (D3 : aucun choix par défaut).
 */
export type SaisieRetours = Record<UUID, { qte: number; enStock: boolean | null }>;

export const MESSAGE_DESTINATION_RETOUR =
  'Choisis « Remettre en stock » ou « Perdu » pour chaque retour.';

/** Nombre de retours saisis (> 0) dont la destination n'est pas choisie. */
export function retoursSansDestination(saisie: SaisieRetours): number {
  return Object.values(saisie).filter((s) => s.qte > 0 && s.enStock === null).length;
}

/**
 * Regroupe les retours saisis (> 0) par livraison source (un PUT par
 * livraison). Refuse toute saisie sans destination choisie.
 */
export function regrouperRetours(
  livraisons: LivraisonResponse[],
  saisie: SaisieRetours,
): { ok: true; valeur: RetoursParLivraison[] } | { ok: false; erreur: string } {
  const res: RetoursParLivraison[] = [];
  for (const livraison of livraisons) {
    const lignes: RetoursParLivraison['lignes'] = [];
    for (const p of livraison.produitsLivraison ?? []) {
      const s = saisie[p.id];
      if (!s || !(s.qte > 0)) continue;
      if (s.enStock === null) return { ok: false, erreur: MESSAGE_DESTINATION_RETOUR };
      lignes.push({ produitLivraisonId: p.id, quantite: s.qte, remettreEnStock: s.enStock });
    }
    if (lignes.length > 0) res.push({ livraison, lignes });
  }
  return { ok: true, valeur: res };
}

/** Prix initial d'une ligne : le prix par défaut du client s'il est > 0, sinon 0 (à saisir). */
export function prixInitialLigne(prixDeVenteParDefaut: number | null | undefined): number {
  return prixDeVenteParDefaut != null && prixDeVenteParDefaut > 0 ? prixDeVenteParDefaut : 0;
}
