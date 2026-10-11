import type { LivraisonResponse, UUID } from '../../../types/api';
import {
  arrondi,
  dansPeriode,
  nomPersonne,
  num,
  parDate,
  retenu,
  somme,
  type FiltresEtat,
  type Periode,
} from './commun';

/** Une livraison de l'état « Ventes / livraisons ». */
export interface LigneVenteLivraison {
  id: UUID;
  date: string;
  reference: string;
  client: string;
  livreur: string;
  /** Dû net serveur (remise et retours compris, avant paiements). */
  montantDu: number;
  /** Remise nette serveur. */
  remise: number;
}

/** Cumul par client sur la période. */
export interface LigneVenteClient {
  clientId: UUID;
  client: string;
  nbLivraisons: number;
  montantDu: number;
  remise: number;
}

/** Cumul par produit sur la période. */
export interface LigneVenteProduit {
  produitId: UUID;
  designation: string;
  qteLivree: number;
  qteRetournee: number;
  /** Quantité vendue = livrée − retournée. */
  qteVendue: number;
  /** (prix de vente + remise unitaire) × quantité vendue, formule du back. */
  montant: number;
}

export interface EtatVentes {
  livraisons: LigneVenteLivraison[];
  parClient: LigneVenteClient[];
  parProduit: LigneVenteProduit[];
  totaux: {
    nbLivraisons: number;
    montantDu: number;
    remise: number;
    qteLivree: number;
    qteRetournee: number;
    qteVendue: number;
    montantProduits: number;
  };
}

/**
 * État « Ventes / livraisons » : par livraison, par client (cumul) et par
 * produit. Les livraisons hors période sont écartées (le back filtre déjà,
 * le contrôle garantit le même résultat quelle que soit la source).
 *
 * Filtres : `clientId` ne garde que les livraisons de ce client ;
 * `produitId` ne garde que les livraisons contenant ce produit et limite
 * tous les montants (livraison, client, produit) aux lignes de ce produit.
 */
export function calculerEtatVentes(
  livraisons: readonly LivraisonResponse[],
  periode: Periode,
  filtres: FiltresEtat = {},
): EtatVentes {
  const produitId = filtres.produitId || null;
  const lignesDe = (l: LivraisonResponse) =>
    (l.produitsLivraison ?? []).filter((p) => retenu(produitId, p.produit?.id));

  const retenues = livraisons
    .filter((l) => dansPeriode(l.date, periode))
    .filter((l) => retenu(filtres.clientId, l.client?.id))
    .filter((l) => !produitId || lignesDe(l).length > 0)
    .sort(parDate((l) => l.date));

  // Montants d'une livraison : ceux du serveur, ou limités aux lignes du produit filtré
  // (même formule que le back : (prix + remise) × (livré − retourné)).
  const montants = (l: LivraisonResponse): { du: number; remise: number } => {
    if (!produitId) return { du: arrondi(num(l.montantDu)), remise: arrondi(num(l.remiseNette)) };
    const lignes = lignesDe(l);
    const vendue = (p: (typeof lignes)[number]) => num(p.qteLivre) - num(p.qteRetourne);
    return {
      du: somme(lignes, (p) => (num(p.prixDeVente) + num(p.remiseUnitaire)) * vendue(p)),
      remise: somme(lignes, (p) => num(p.remiseUnitaire) * vendue(p)),
    };
  };

  const lignes: LigneVenteLivraison[] = retenues.map((l) => {
    const mt = montants(l);
    return {
      id: l.id,
      date: l.date,
      reference: l.reference ?? '',
      client: nomPersonne(l.client),
      livreur: nomPersonne(l.livreur),
      montantDu: mt.du,
      remise: mt.remise,
    };
  });

  const clients = new Map<UUID, LigneVenteClient>();
  for (const l of retenues) {
    const id = l.client?.id ?? '';
    const c = clients.get(id) ?? {
      clientId: id,
      client: nomPersonne(l.client),
      nbLivraisons: 0,
      montantDu: 0,
      remise: 0,
    };
    const mt = montants(l);
    c.nbLivraisons += 1;
    c.montantDu = arrondi(c.montantDu + mt.du);
    c.remise = arrondi(c.remise + mt.remise);
    clients.set(id, c);
  }

  const produits = new Map<UUID, LigneVenteProduit>();
  for (const l of retenues) {
    for (const p of lignesDe(l)) {
      const id = p.produit?.id ?? '';
      const ligne = produits.get(id) ?? {
        produitId: id,
        designation: p.produit?.designation ?? '',
        qteLivree: 0,
        qteRetournee: 0,
        qteVendue: 0,
        montant: 0,
      };
      const livree = num(p.qteLivre);
      const retournee = num(p.qteRetourne);
      ligne.qteLivree += livree;
      ligne.qteRetournee += retournee;
      ligne.qteVendue += livree - retournee;
      ligne.montant = arrondi(
        ligne.montant + (num(p.prixDeVente) + num(p.remiseUnitaire)) * (livree - retournee),
      );
      produits.set(id, ligne);
    }
  }

  const parClient = [...clients.values()].sort(
    (a, b) => b.montantDu - a.montantDu || a.client.localeCompare(b.client, 'fr'),
  );
  const parProduit = [...produits.values()].sort((a, b) =>
    a.designation.localeCompare(b.designation, 'fr'),
  );

  return {
    livraisons: lignes,
    parClient,
    parProduit,
    totaux: {
      nbLivraisons: lignes.length,
      montantDu: somme(lignes, (l) => l.montantDu),
      remise: somme(lignes, (l) => l.remise),
      qteLivree: parProduit.reduce((a, p) => a + p.qteLivree, 0),
      qteRetournee: parProduit.reduce((a, p) => a + p.qteRetournee, 0),
      qteVendue: parProduit.reduce((a, p) => a + p.qteVendue, 0),
      montantProduits: somme(parProduit, (p) => p.montant),
    },
  };
}
