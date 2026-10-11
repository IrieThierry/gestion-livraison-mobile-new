import { jourDe, jourLocal, type Periode } from './calculs/commun';

export type { Periode } from './calculs/commun';

export type RaccourciPeriode = 'mois' | 'moisPrecedent' | '30j';

export const RACCOURCIS_PERIODE: Array<{ key: RaccourciPeriode; label: string }> = [
  { key: 'mois', label: 'Ce mois' },
  { key: 'moisPrecedent', label: 'Mois précédent' },
  { key: '30j', label: '30 jours' },
];

/** Période d'un raccourci, en jours entiers `yyyy-MM-dd`. */
export function periodeRaccourci(key: RaccourciPeriode, now: Date = new Date()): Periode {
  const a = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'moisPrecedent':
      return { debut: jourLocal(new Date(a, m - 1, 1)), fin: jourLocal(new Date(a, m, 0)) };
    case '30j':
      return { debut: jourLocal(new Date(a, m, now.getDate() - 29)), fin: jourLocal(now) };
    default:
      return { debut: jourLocal(new Date(a, m, 1)), fin: jourLocal(now) };
  }
}

/** Période par défaut des états : le mois en cours, du 1er à aujourd'hui. */
export function periodeParDefaut(now: Date = new Date()): Periode {
  return periodeRaccourci('mois', now);
}

/** Message bloquant pour une période saisie, ou null si elle est valide. */
export function erreurPeriode(p: { debut: string | null; fin: string | null }): string | null {
  if (!p.debut || !p.fin) return 'Choisissez une date de début et une date de fin.';
  if (p.debut > p.fin) return 'La date de début doit précéder la date de fin.';
  return null;
}

/** `2026-10-05` (ou `2026-10-05T14:30:00`) → `05/10/2026`. */
export function formatJour(iso: string | null | undefined): string {
  const j = jourDe(iso);
  if (!j) return '';
  const [a, m, d] = j.split('-');
  return `${d}/${m}/${a}`;
}

/** « du 01/10/2026 au 11/10/2026 ». */
export function libellePeriode(p: Periode): string {
  return `du ${formatJour(p.debut)} au ${formatJour(p.fin)}`;
}
