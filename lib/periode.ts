/**
 * Filtres de période des listes (retours, fiche client, mouvements de stock,
 * Mes livraisons) : raccourcis propres à l'écran (« Ce mois », « 30 jours »…)
 * plus « Période… », un intervalle Du / Au choisi par l'utilisateur.
 *
 * Jours entiers au format `yyyy-MM-dd`, bornes incluses : c'est ce que les
 * routes du back attendent pour `debut` / `fin` (jours entiers, bornes
 * incluses) ; le filtrage local (`dansBornes`) suit la même règle.
 */

export interface Bornes {
  /** Premier jour inclus (`yyyy-MM-dd`), absent = sans limite. */
  debut?: string;
  /** Dernier jour inclus (`yyyy-MM-dd`), absent = sans limite. */
  fin?: string;
}

/** Valeur d'un filtre de période : un raccourci de l'écran, ou un intervalle Du / Au. */
export type ValeurPeriode<K extends string = string> = { cle: K } | { du: string; au: string };

export interface OptionPeriode<K extends string = string> {
  cle: K;
  label: string;
  /** Bornes du raccourci à la date `now`. */
  bornes: (now: Date) => Bornes;
}

/** Libellé de la pastille qui ouvre le choix Du / Au. */
export const LIBELLE_PERIODE_PERSO = 'Période…';

/** Jour local `yyyy-MM-dd`. */
export function jourIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

/** `yyyy-MM-dd` → date locale à minuit (pas de décalage UTC). */
export function dateDeJour(jour: string): Date {
  const [a, m, j] = jour.slice(0, 10).split('-').map(Number);
  return new Date(a, (m || 1) - 1, j || 1);
}

/** Aujourd'hui seulement. */
export function aujourdhui(now: Date = new Date()): Required<Bornes> {
  const j = jourIso(now);
  return { debut: j, fin: j };
}

/** Mois en cours, du 1er à aujourd'hui. */
export function moisEnCours(now: Date = new Date()): Required<Bornes> {
  return { debut: jourIso(new Date(now.getFullYear(), now.getMonth(), 1)), fin: jourIso(now) };
}

/** Les `jours` derniers jours, aujourd'hui compris. */
export function derniersJours(jours: number, now: Date = new Date()): Required<Bornes> {
  return {
    debut: jourIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (jours - 1))),
    fin: jourIso(now),
  };
}

export function estPeriodePerso<K extends string>(v: ValeurPeriode<K>): v is { du: string; au: string } {
  return 'du' in v;
}

/**
 * Intervalle Du / Au valide : Au jamais après aujourd'hui, Du jamais après Au
 * (Du ramené à Au s'il le dépasse).
 */
export function corrigerIntervalle(du: string, au: string, now: Date = new Date()): { du: string; au: string } {
  const max = jourIso(now);
  const fin = au > max ? max : au;
  const debut = du > fin ? fin : du;
  return { du: debut, au: fin };
}

/** Bornes envoyées aux routes (`debut` / `fin`) ou utilisées pour filtrer localement. */
export function bornesPeriode<K extends string>(
  valeur: ValeurPeriode<K>,
  options: ReadonlyArray<OptionPeriode<K>>,
  now: Date = new Date(),
): Bornes {
  if (estPeriodePerso(valeur)) {
    const { du, au } = corrigerIntervalle(valeur.du, valeur.au, now);
    return { debut: du, fin: au };
  }
  return options.find((o) => o.cle === valeur.cle)?.bornes(now) ?? {};
}

/** `2026-10-01` → `01/10` (l'année seulement si ce n'est pas l'année en cours). */
function jourCourt(jour: string, now: Date): string {
  const [a, m, j] = jour.slice(0, 10).split('-');
  return Number(a) === now.getFullYear() ? `${j}/${m}` : `${j}/${m}/${a}`;
}

/** Libellé de la pastille d'un intervalle : « 01/10 → 12/10 ». */
export function libelleIntervalle(du: string, au: string, now: Date = new Date()): string {
  return `${jourCourt(du, now)} → ${jourCourt(au, now)}`;
}

/** Vrai si la date (`yyyy-MM-dd…`) est dans les bornes (jours entiers, inclus). Sans date : hors bornes dès qu'il y en a. */
export function dansBornes(date: string | null | undefined, bornes: Bornes): boolean {
  if (!bornes.debut && !bornes.fin) return true;
  if (!date) return false;
  const j = date.slice(0, 10);
  return (!bornes.debut || j >= bornes.debut) && (!bornes.fin || j <= bornes.fin);
}
