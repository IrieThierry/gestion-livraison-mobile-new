import { ajouterJours, jourCourt } from '../previsions/regles';

/**
 * Tableau de bord du responsable (O16) sur le mobile : règles d'affichage,
 * fonctions pures. Les ventes, avoirs et encaissements portent sur le jour
 * choisi ; l'argent non remis est cumulé jusqu'à la fin de ce jour ; stock,
 * transit, encours et demandes sont l'état actuel.
 */

export const LIBELLE_VALEUR_INCOMPLETE = 'valeur incomplète';
export const LIBELLE_ETAT_ACTUEL = 'État actuel';

/** « Aujourd’hui », « Hier », sinon `dd/MM/yyyy`. */
export function libelleJourTableau(jour: string, aujourdhui: string): string {
  if (jour === aujourdhui) return 'Aujourd’hui';
  if (jour === ajouterJours(aujourdhui, -1)) return 'Hier';
  return jourCourt(jour);
}

export function jourPrecedent(jour: string): string {
  return ajouterJours(jour, -1);
}

export function jourSuivant(jour: string): string {
  return ajouterJours(jour, 1);
}

/** On n'avance pas au-delà d'aujourd'hui (jours `yyyy-MM-dd`, comparables en texte). */
export function peutAvancer(jour: string, aujourdhui: string): boolean {
  return jour < aujourdhui;
}

/** Stock valorisé dont au moins un produit n'a pas de prix : sa valeur est incomplète. */
export function valeurIncomplete(bloc: { produitsSansPrix: number }): boolean {
  return Number(bloc.produitsSansPrix) > 0;
}

export function nomCommercial(c: { prenom: string | null; nom: string | null }): string {
  return [c.prenom, c.nom].filter(Boolean).join(' ') || '—';
}
