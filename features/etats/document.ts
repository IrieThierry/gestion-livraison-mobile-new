import { formatMontant } from '../../lib/format';
import { descriptionFamille, type FamilleEtat } from './acces';
import type { Periode } from './calculs/commun';
import type { EtatEncaissements } from './calculs/encaissements';
import type { EtatFournisseurs } from './calculs/fournisseurs';
import type { EtatStock } from './calculs/stock';
import type { EtatVentes } from './calculs/ventes';
import { formatJour } from './periode';

/**
 * Modèle d'un état mis en forme, commun à l'aperçu à l'écran et au PDF :
 * les deux affichent exactement les mêmes lignes et les mêmes totaux.
 */
export interface ColonneEtat {
  libelle: string;
  /** Montants et quantités à droite. */
  droite?: boolean;
}

export interface SectionEtat {
  titre: string;
  note?: string;
  colonnes: ColonneEtat[];
  lignes: string[][];
  /** Ligne de totaux (même nombre de cellules que les colonnes). */
  totaux?: string[];
  /** Message d'une section sans ligne. */
  vide: string;
}

export interface SyntheseEtat {
  libelle: string;
  valeur: string;
}

export interface DocumentEtat {
  famille: FamilleEtat;
  titre: string;
  livreur: string;
  periode: Periode;
  editeLe: Date;
  syntheses: SyntheseEtat[];
  sections: SectionEtat[];
}

export interface EnteteEtat {
  livreur: string;
  periode: Periode;
  editeLe: Date;
  /** Vue équipe : une colonne « Livreur » est ajoutée. */
  equipe: boolean;
}

const m = (n: number | null | undefined): string => (n == null ? '—' : formatMontant(n));
const q = (n: number): string => formatMontant(n);
const signe = (n: number): string => (n > 0 ? `+${q(n)}` : n < 0 ? `−${q(-n)}` : '0');

function base(famille: FamilleEtat, e: EnteteEtat) {
  return {
    famille,
    titre: descriptionFamille(famille).titre,
    livreur: e.livreur,
    periode: e.periode,
    editeLe: e.editeLe,
  };
}

/** Insère la colonne « Livreur » en 2e position en vue équipe. */
function avecLivreur<T>(equipe: boolean, cellules: T[], livreur: T): T[] {
  return equipe ? [cellules[0], livreur, ...cellules.slice(1)] : cellules;
}

export function documentVentes(etat: EtatVentes, e: EnteteEtat): DocumentEtat {
  const t = etat.totaux;
  return {
    ...base('ventes', e),
    syntheses: [
      { libelle: 'Livraisons', valeur: q(t.nbLivraisons) },
      { libelle: 'Montant dû', valeur: m(t.montantDu) },
      { libelle: 'Remise', valeur: m(t.remise) },
      { libelle: 'Quantité vendue', valeur: q(t.qteVendue) },
    ],
    sections: [
      {
        titre: 'Par livraison',
        colonnes: avecLivreur(
          e.equipe,
          [
            { libelle: 'Date' },
            { libelle: 'Référence' },
            { libelle: 'Client' },
            { libelle: 'Montant dû', droite: true },
            { libelle: 'Remise', droite: true },
          ],
          { libelle: 'Livreur' },
        ),
        lignes: etat.livraisons.map((l) =>
          avecLivreur(
            e.equipe,
            [formatJour(l.date), l.reference, l.client, m(l.montantDu), m(l.remise)],
            l.livreur,
          ),
        ),
        totaux: avecLivreur(
          e.equipe,
          ['Total', `${q(t.nbLivraisons)} livraison${t.nbLivraisons > 1 ? 's' : ''}`, '', m(t.montantDu), m(t.remise)],
          '',
        ),
        vide: 'Aucune livraison sur la période.',
      },
      {
        titre: 'Par client',
        colonnes: [
          { libelle: 'Client' },
          { libelle: 'Livraisons', droite: true },
          { libelle: 'Montant dû', droite: true },
          { libelle: 'Remise', droite: true },
        ],
        lignes: etat.parClient.map((c) => [c.client, q(c.nbLivraisons), m(c.montantDu), m(c.remise)]),
        totaux: ['Total', q(t.nbLivraisons), m(t.montantDu), m(t.remise)],
        vide: 'Aucun client livré sur la période.',
      },
      {
        titre: 'Par produit',
        colonnes: [
          { libelle: 'Produit' },
          { libelle: 'Livrée', droite: true },
          { libelle: 'Retournée', droite: true },
          { libelle: 'Vendue', droite: true },
          { libelle: 'Montant', droite: true },
        ],
        lignes: etat.parProduit.map((p) => [
          p.designation,
          q(p.qteLivree),
          q(p.qteRetournee),
          q(p.qteVendue),
          m(p.montant),
        ]),
        totaux: ['Total', q(t.qteLivree), q(t.qteRetournee), q(t.qteVendue), m(t.montantProduits)],
        vide: 'Aucun produit livré sur la période.',
      },
    ],
  };
}

export function documentEncaissements(etat: EtatEncaissements, e: EnteteEtat): DocumentEtat {
  const t = etat.totaux;
  return {
    ...base('encaissements', e),
    syntheses: [
      { libelle: 'Encaissé', valeur: m(t.montantEncaisse) },
      { libelle: 'Encaissements', valeur: q(t.nbEncaissements) },
      { libelle: 'Dû par les clients', valeur: m(t.totalDu) },
      { libelle: 'Avances clients', valeur: m(t.totalAvances) },
    ],
    sections: [
      {
        titre: 'Encaissements de la période',
        colonnes: avecLivreur(
          e.equipe,
          [
            { libelle: 'Date' },
            { libelle: 'Référence' },
            { libelle: 'Client' },
            { libelle: 'Montant', droite: true },
            { libelle: 'Écart', droite: true },
          ],
          { libelle: 'Livreur' },
        ),
        lignes: etat.encaissements.map((x) =>
          avecLivreur(
            e.equipe,
            [formatJour(x.date), x.reference, x.client, m(x.montant), signe(x.ecart)],
            x.livreur,
          ),
        ),
        totaux: avecLivreur(
          e.equipe,
          ['Total', `${q(t.nbEncaissements)} encaissement${t.nbEncaissements > 1 ? 's' : ''}`, '', m(t.montantEncaisse), signe(t.ecart)],
          '',
        ),
        vide: 'Aucun encaissement sur la période.',
      },
      {
        titre: 'Créances clients — solde actuel',
        note: 'Solde actuel à la date d’édition (positif = dû, négatif = avance).',
        colonnes: [
          { libelle: 'Client' },
          { libelle: 'Total livré', droite: true },
          { libelle: 'Total encaissé', droite: true },
          { libelle: 'Solde actuel', droite: true },
        ],
        lignes: etat.creances.map((c) => [c.client, m(c.totalLivre), m(c.totalEncaisse), m(c.solde)]),
        totaux: ['Solde net', '', '', m(t.soldeNet)],
        vide: 'Aucun client avec un solde.',
      },
    ],
  };
}

export function documentStock(etat: EtatStock, e: EnteteEtat): DocumentEtat {
  const t = etat.totaux;
  return {
    ...base('stock', e),
    syntheses: [
      { libelle: 'Quantité en stock', valeur: q(t.qteStock) },
      { libelle: 'Mouvements', valeur: q(t.nbMouvements) },
      { libelle: 'Entrées', valeur: q(t.entrees) },
      { libelle: 'Sorties', valeur: q(t.sorties) },
    ],
    sections: [
      {
        titre: 'Stock courant',
        note: 'Stock à la date d’édition.',
        colonnes: [{ libelle: 'Produit' }, { libelle: 'Quantité', droite: true }],
        lignes: etat.stock.map((p) => [p.designation, q(p.qte)]),
        totaux: ['Total', q(t.qteStock)],
        vide: 'Aucun produit en stock.',
      },
      {
        titre: 'Mouvements par type',
        colonnes: [
          { libelle: 'Type' },
          { libelle: 'Nombre', droite: true },
          { libelle: 'Entrées', droite: true },
          { libelle: 'Sorties', droite: true },
          { libelle: 'Net', droite: true },
        ],
        lignes: etat.parType.map((x) => [x.libelle, q(x.nb), q(x.entrees), q(x.sorties), signe(x.net)]),
        totaux: ['Total', q(t.nbMouvements), q(t.entrees), q(t.sorties), signe(t.net)],
        vide: 'Aucun mouvement sur la période.',
      },
      {
        titre: 'Détail des mouvements',
        colonnes: avecLivreur(
          e.equipe,
          [
            { libelle: 'Date' },
            { libelle: 'Type' },
            { libelle: 'Produit' },
            { libelle: 'Quantité', droite: true },
            { libelle: 'Détail' },
          ],
          { libelle: 'Livreur' },
        ),
        lignes: etat.mouvements.map((x) =>
          avecLivreur(
            e.equipe,
            [formatJour(x.date), x.libelleType, x.produit, signe(x.quantite), x.detail],
            x.livreur,
          ),
        ),
        vide: 'Aucun mouvement sur la période.',
      },
    ],
  };
}

export function documentFournisseurs(etat: EtatFournisseurs, e: EnteteEtat): DocumentEtat {
  const t = etat.totaux;
  return {
    ...base('fournisseurs', e),
    syntheses: [
      { libelle: 'Commandes', valeur: q(t.nbCommandes) },
      { libelle: 'Reçu sur la période', valeur: m(t.montantRecu) },
      { libelle: 'Versé', valeur: m(t.montantVerse) },
      { libelle: 'Dû aux fournisseurs', valeur: m(t.du) },
    ],
    sections: [
      {
        titre: 'Par fournisseur',
        note: 'Dû et remise à recevoir : valeurs actuelles (négatif = avance).',
        colonnes: [
          { libelle: 'Fournisseur' },
          { libelle: 'Commandes', droite: true },
          { libelle: 'Reçu sur la période', droite: true },
          { libelle: 'Versé', droite: true },
          { libelle: 'Dû', droite: true },
          { libelle: 'Remise à recevoir', droite: true },
        ],
        lignes: etat.parFournisseur.map((f) => [
          f.fournisseur,
          q(f.nbCommandes),
          m(f.montantRecu),
          m(f.montantVerse),
          m(f.du),
          m(f.remiseARecevoir),
        ]),
        totaux: ['Total', q(t.nbCommandes), m(t.montantRecu), m(t.montantVerse), m(t.du), m(t.remiseARecevoir)],
        vide: 'Aucun fournisseur partenaire.',
      },
      {
        titre: 'Commandes de la période',
        note: 'Reçu (total commande) : toutes les réceptions actives de la commande, y compris hors période.',
        colonnes: [
          { libelle: 'Date' },
          { libelle: 'Référence' },
          { libelle: 'Fournisseur' },
          { libelle: 'Statut' },
          { libelle: 'Reçu (total commande)', droite: true },
        ],
        lignes: etat.commandes.map((c) => [
          formatJour(c.date),
          c.reference,
          c.fournisseur,
          c.statut,
          m(c.montantRecu),
        ]),
        totaux: ['Total', `${q(t.nbCommandes)} commande${t.nbCommandes > 1 ? 's' : ''}`, '', '', m(t.montantCommandes)],
        vide: 'Aucune commande sur la période.',
      },
      {
        titre: 'Réceptions de la période',
        colonnes: [
          { libelle: 'Date' },
          { libelle: 'Référence' },
          { libelle: 'Commande' },
          { libelle: 'Fournisseur' },
          { libelle: 'Montant', droite: true },
          { libelle: 'Remise', droite: true },
        ],
        lignes: etat.receptions.map((r) => [
          formatJour(r.date),
          r.reference,
          r.commande,
          r.fournisseur,
          m(r.montant),
          m(r.remise),
        ]),
        totaux: ['Total', '', '', '', m(t.montantRecu), m(t.remiseRecue)],
        vide: 'Aucune réception sur la période.',
      },
      {
        titre: 'Versements de la période',
        colonnes: [
          { libelle: 'Date' },
          { libelle: 'Fournisseur' },
          { libelle: 'Montant versé', droite: true },
          { libelle: 'Dette après', droite: true },
        ],
        lignes: etat.versements.map((v) => [
          formatJour(v.date),
          v.fournisseur,
          m(v.montantVerse),
          m(v.detteApres),
        ]),
        totaux: ['Total', '', m(t.montantVerse), ''],
        vide: 'Aucun versement sur la période.',
      },
    ],
  };
}
