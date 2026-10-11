import type { LivraisonResponse, UUID } from '../../../types/api';
import { arrondi, dansPeriode, nomPersonne, num, parDate, somme, type Periode } from './commun';

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
 */
export function calculerEtatVentes(
  livraisons: readonly LivraisonResponse[],
  periode: Periode,
): EtatVentes {
  const retenues = livraisons
    .filter((l) => dansPeriode(l.date, periode))
    .sort(parDate((l) => l.date));

  const lignes: LigneVenteLivraison[] = retenues.map((l) => ({
    id: l.id,
    date: l.date,
    reference: l.reference ?? '',
    client: nomPersonne(l.client),
    livreur: nomPersonne(l.livreur),
    montantDu: arrondi(num(l.montantDu)),
    remise: arrondi(num(l.remiseNette)),
  }));

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
    c.nbLivraisons += 1;
    c.montantDu = arrondi(c.montantDu + num(l.montantDu));
    c.remise = arrondi(c.remise + num(l.remiseNette));
    clients.set(id, c);
  }

  const produits = new Map<UUID, LigneVenteProduit>();
  for (const l of retenues) {
    for (const p of l.produitsLivraison ?? []) {
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
