import type { TypeMouvementStock } from '../../../types/api';

/**
 * Outils communs aux calculs des états. Fonctions pures : les mêmes
 * résultats alimentent l'aperçu à l'écran et le PDF.
 */

/** Période en jours entiers `yyyy-MM-dd`, bornes incluses (comme le back). */
export interface Periode {
  debut: string;
  fin: string;
}

/** `Number()` défensif : un BigDecimal peut arriver en chaîne ("1500.00"). */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Arrondi au centime, comme les autres totaux de l'application. */
export function arrondi(n: number): number {
  const r = Math.round(num(n) * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/** Somme arrondie au centime. */
export function somme<T>(liste: readonly T[], valeur: (x: T) => unknown): number {
  return arrondi(liste.reduce((acc, x) => acc + num(valeur(x)), 0));
}

/** Jour local `yyyy-MM-dd` d'une date. */
export function jourLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

/**
 * Jour `yyyy-MM-dd` d'une date du back. Le back renvoie des dates locales
 * sans fuseau (`2026-10-05T14:30:00`) : on garde la partie date telle quelle
 * pour ne pas décaler le jour. Null si la valeur est vide ou illisible.
 */
export function jourDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (m) return m[1];
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : jourLocal(d);
}

/** Vrai si la date tombe dans la période (jours entiers, bornes incluses). */
export function dansPeriode(iso: string | null | undefined, periode: Periode): boolean {
  const j = jourDe(iso);
  if (!j) return false;
  return j >= periode.debut && j <= periode.fin;
}

/** Tri du plus ancien au plus récent (dates ISO comparables en texte). */
export function parDate<T>(date: (x: T) => string | null | undefined) {
  return (a: T, b: T): number => (date(a) ?? '').localeCompare(date(b) ?? '');
}

/** « Prénom Nom » sans espaces superflus. */
export function nomPersonne(p: { prenom?: string | null; nom?: string | null } | null | undefined): string {
  if (!p) return '';
  return `${p.prenom ?? ''} ${p.nom ?? ''}`.replace(/\s+/g, ' ').trim();
}

/**
 * Filtres d'entité des états (en plus de la période et du livreur). Absent
 * ou null = « Tous ». Chaque famille n'utilise que les siens.
 */
export interface FiltresEtat {
  clientId?: string | null;
  produitId?: string | null;
  fournisseurId?: string | null;
  typeMouvement?: TypeMouvementStock | null;
}

/** Vrai si le filtre est vide (« Tous ») ou correspond à l'identifiant. */
export function retenu(filtre: string | null | undefined, id: string | null | undefined): boolean {
  return !filtre || filtre === id;
}
