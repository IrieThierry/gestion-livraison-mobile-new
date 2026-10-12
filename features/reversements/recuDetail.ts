import { arrondi, dansPeriode, jourLocal, num, parDate, type Periode } from '../etats/calculs/commun';
import { formatJour } from '../etats/periode';
import { formatMontant } from '../../lib/format';
import type { CommandeResponse, LivraisonResponse, RetourResponse, ReversementRecord, UUID } from '../../types/api';

/**
 * Détail du reçu de reversement sur la période du reversement (mois civil
 * `periodeMois` / `periodeAnnee`). Fonctions pures, mêmes règles et libellés
 * que le web (src/features/reversements/recu-detail.ts) :
 * - bénéficiaire client (type CLIENT) : une ligne par produit (ventes du
 *   client et retours du mois) ;
 * - bénéficiaire livreur (type FOURNISSEUR) : une ligne par produit de chaque
 *   commande reçue dans le mois.
 */

export const TITRE_DETAIL = 'Détail sur la période';
export const AUCUN_DETAIL = 'Aucun détail sur la période';
export const DETAIL_INDISPONIBLE = 'Détail indisponible';
/** Message à l'écran quand le détail n'a pas pu être lu (le reçu est quand même généré). */
export const MESSAGE_DETAIL_INDISPONIBLE = 'Détail indisponible : le reçu a été généré sans le détail de la période.';

export const COLONNES_DETAIL_CLIENT = ['Produit', 'Qté vendue', 'Qté retournée', 'Qté nette', 'Montant', 'Remise'] as const;
export const COLONNES_DETAIL_LIVREUR = ['Commande', 'Date', 'Produit', 'Qté', 'Montant'] as const;

/** Bornes `yyyy-MM-dd` (jours entiers, bornes incluses) du mois du reversement ; null sans période. */
export function periodeDuReversement(r: Pick<ReversementRecord, 'periodeMois' | 'periodeAnnee'>): Periode | null {
  const mois = Number(r.periodeMois);
  const annee = Number(r.periodeAnnee);
  if (!Number.isInteger(mois) || mois < 1 || mois > 12 || !Number.isInteger(annee) || annee < 1) return null;
  return { debut: jourLocal(new Date(annee, mois - 1, 1)), fin: jourLocal(new Date(annee, mois, 0)) };
}

// ─── Bénéficiaire client ─────────────────────────────────────────────────────

export interface LigneDetailClient {
  produitId: UUID;
  designation: string;
  /** Σ quantité livrée des livraisons du mois. */
  qteVendue: number;
  /** Σ nette des retours du mois (corrections déduites). */
  qteRetournee: number;
  /** Qté vendue − qté retournée. */
  qteNette: number;
  /** Formule de l'état Ventes : (prix de vente + remise unitaire) × (livré − retourné sur la livraison). */
  montant: number;
  /** Formule de l'état Ventes : remise unitaire × (livré − retourné sur la livraison). */
  remise: number;
}

export interface DetailClient {
  type: 'client';
  lignes: LigneDetailClient[];
  totaux: { qteVendue: number; qteRetournee: number; qteNette: number; montant: number; remise: number };
}

/**
 * Livraisons du client dont la date tombe dans le mois et retours du client
 * dont la date de retour tombe dans le mois. Une ligne par produit (livré ou
 * retourné), triée par désignation.
 */
export function detailClient(
  livraisons: readonly LivraisonResponse[],
  retours: readonly RetourResponse[],
  clientId: UUID,
  periode: Periode,
): DetailClient {
  const parProduit = new Map<UUID, LigneDetailClient>();
  const ligneDe = (id: UUID, designation: string | null | undefined): LigneDetailClient => {
    let l = parProduit.get(id);
    if (!l) {
      l = { produitId: id, designation: designation ?? '—', qteVendue: 0, qteRetournee: 0, qteNette: 0, montant: 0, remise: 0 };
      parProduit.set(id, l);
    }
    return l;
  };
  for (const liv of livraisons) {
    if (liv.client?.id !== clientId || !dansPeriode(liv.date, periode)) continue;
    for (const p of liv.produitsLivraison ?? []) {
      const l = ligneDe(p.produit?.id ?? '', p.produit?.designation);
      const vendu = num(p.qteLivre) - num(p.qteRetourne);
      l.qteVendue += num(p.qteLivre);
      l.montant = arrondi(l.montant + (num(p.prixDeVente) + num(p.remiseUnitaire)) * vendu);
      l.remise = arrondi(l.remise + num(p.remiseUnitaire) * vendu);
    }
  }
  for (const r of retours) {
    if (r.client?.id !== clientId || !dansPeriode(r.dateRetour, periode)) continue;
    ligneDe(r.produit?.id ?? '', r.produit?.designation).qteRetournee += num(r.quantite);
  }
  const lignes = [...parProduit.values()]
    .map((l) => ({ ...l, qteNette: l.qteVendue - l.qteRetournee }))
    .filter((l) => l.qteVendue !== 0 || l.qteRetournee !== 0)
    .sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));
  return {
    type: 'client',
    lignes,
    totaux: {
      qteVendue: lignes.reduce((s, l) => s + l.qteVendue, 0),
      qteRetournee: lignes.reduce((s, l) => s + l.qteRetournee, 0),
      qteNette: lignes.reduce((s, l) => s + l.qteNette, 0),
      montant: arrondi(lignes.reduce((s, l) => s + l.montant, 0)),
      remise: arrondi(lignes.reduce((s, l) => s + l.remise, 0)),
    },
  };
}

// ─── Bénéficiaire livreur ────────────────────────────────────────────────────

export interface LigneDetailCommande {
  produitId: UUID;
  designation: string;
  quantite: number;
  montant: number;
}

export interface CommandeDetail {
  id: UUID;
  reference: string;
  /** Date de la commande (ISO). */
  date: string;
  lignes: LigneDetailCommande[];
  sousTotal: { quantite: number; montant: number };
}

export interface DetailLivreur {
  type: 'livreur';
  commandes: CommandeDetail[];
  totaux: { quantite: number; montant: number };
}

/**
 * Commandes du livreur chez le fournisseur ayant au moins une réception
 * active datée du mois (quelle que soit la date de la commande, comme le bloc
 * « Par produit » de l'état Fournisseurs). Par commande, une ligne par
 * produit : quantité = Σ des quantités des réceptions actives du mois,
 * montant = Σ quantité × prix figé à la réception. Filtres facultatifs
 * (null = pas de filtre) : la route lue peut déjà être limitée au livreur ou
 * au fournisseur. Commandes triées par date puis référence, produits par
 * désignation.
 */
export function detailLivreur(
  commandes: readonly CommandeResponse[],
  filtres: { livreurId: UUID | null; fournisseurId: UUID | null },
  periode: Periode,
): DetailLivreur {
  const resultat: CommandeDetail[] = [];
  for (const c of commandes) {
    if (filtres.livreurId && c.livreur?.id !== filtres.livreurId) continue;
    if (filtres.fournisseurId && c.fournisseur?.id !== filtres.fournisseurId) continue;
    const parProduit = new Map<UUID, LigneDetailCommande>();
    for (const rec of c.receptions ?? []) {
      if (rec.annulee || !dansPeriode(rec.dateReception, periode)) continue;
      for (const l of rec.lignes ?? []) {
        const id = l.produit?.id ?? '';
        const ligne = parProduit.get(id) ?? { produitId: id, designation: l.produit?.designation ?? '—', quantite: 0, montant: 0 };
        ligne.quantite += num(l.quantite);
        ligne.montant = arrondi(ligne.montant + num(l.quantite) * num(l.prixUnitaire));
        parProduit.set(id, ligne);
      }
    }
    const lignes = [...parProduit.values()]
      .filter((l) => l.quantite !== 0)
      .sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));
    if (lignes.length === 0) continue;
    resultat.push({
      id: c.id,
      reference: c.reference ?? '',
      date: c.date,
      lignes,
      sousTotal: {
        quantite: lignes.reduce((s, l) => s + l.quantite, 0),
        montant: arrondi(lignes.reduce((s, l) => s + l.montant, 0)),
      },
    });
  }
  resultat.sort((a, b) => parDate<CommandeDetail>((c) => c.date)(a, b) || a.reference.localeCompare(b.reference, 'fr'));
  return {
    type: 'livreur',
    commandes: resultat,
    totaux: {
      quantite: resultat.reduce((s, c) => s + c.sousTotal.quantite, 0),
      montant: arrondi(resultat.reduce((s, c) => s + c.sousTotal.montant, 0)),
    },
  };
}

// ─── Détail du reçu et tableau du document ───────────────────────────────────

/** Détail calculé, absent (reversement sans période) ou indisponible (lecture en échec). */
export type DetailRecu = DetailClient | DetailLivreur | { type: 'aucun' } | { type: 'indisponible' };

export const DETAIL_AUCUN: DetailRecu = { type: 'aucun' };
export const DETAIL_EN_ECHEC: DetailRecu = { type: 'indisponible' };

/** Tableau du reçu, cellules en texte (rendu HTML par `genererHtmlRecu`). */
export interface TableauDetail {
  titre: string;
  /** `droite` : colonne de nombres, alignée à droite. */
  colonnes: Array<{ libelle: string; droite: boolean }>;
  lignes: string[][];
  /** Index (dans `lignes`) des lignes de sous-total. */
  sousTotaux: number[];
  /** Ligne de total en pied, absente sans ligne. */
  totaux?: string[];
  /** Texte affiché quand il n'y a aucune ligne. */
  vide: string;
}

const quantite = (n: number) => formatMontant(n);
/** Montant en F CFA, comme le montant du reçu et le web : `12 500 F CFA`. */
const montant = (n: number) => `${formatMontant(n)} F CFA`;

export function tableauDetail(detail: DetailRecu): TableauDetail {
  if (detail.type === 'client') {
    return {
      titre: TITRE_DETAIL,
      colonnes: COLONNES_DETAIL_CLIENT.map((libelle, i) => ({ libelle, droite: i > 0 })),
      lignes: detail.lignes.map((l) => [
        l.designation,
        quantite(l.qteVendue),
        quantite(l.qteRetournee),
        quantite(l.qteNette),
        montant(l.montant),
        montant(l.remise),
      ]),
      sousTotaux: [],
      totaux:
        detail.lignes.length > 0
          ? [
              'Total',
              quantite(detail.totaux.qteVendue),
              quantite(detail.totaux.qteRetournee),
              quantite(detail.totaux.qteNette),
              montant(detail.totaux.montant),
              montant(detail.totaux.remise),
            ]
          : undefined,
      vide: AUCUN_DETAIL,
    };
  }
  if (detail.type === 'livreur') {
    const lignes: string[][] = [];
    const sousTotaux: number[] = [];
    for (const c of detail.commandes) {
      for (const l of c.lignes) {
        lignes.push([c.reference, formatJour(c.date), l.designation, quantite(l.quantite), montant(l.montant)]);
      }
      sousTotaux.push(lignes.length);
      lignes.push([`Sous-total ${c.reference}`, '', '', quantite(c.sousTotal.quantite), montant(c.sousTotal.montant)]);
    }
    return {
      titre: TITRE_DETAIL,
      colonnes: COLONNES_DETAIL_LIVREUR.map((libelle, i) => ({ libelle, droite: i >= 3 })),
      lignes,
      sousTotaux,
      totaux:
        detail.commandes.length > 0
          ? ['Total', '', '', quantite(detail.totaux.quantite), montant(detail.totaux.montant)]
          : undefined,
      vide: AUCUN_DETAIL,
    };
  }
  return {
    titre: TITRE_DETAIL,
    colonnes: [],
    lignes: [],
    sousTotaux: [],
    vide: detail.type === 'indisponible' ? DETAIL_INDISPONIBLE : AUCUN_DETAIL,
  };
}
