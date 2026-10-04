/**
 * Format a number as FCFA (Franc CFA) — French locale, no decimals, rounded to integer.
 * Returns '0' for null/undefined.
 */
export function formatFCFA(n: number | null | undefined): string {
  if (n == null) return '0';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

/**
 * Montant avec jusqu'à 2 décimales (paiements, soldes : le back manipule
 * des BigDecimal). Valeur absolue NON prise : le signe est conservé.
 */
export function formatMontant(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(n));
}

/**
 * Format a date as 'DD MMM' (e.g., '29 avr.').
 */
export function formatDateShort(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/**
 * Format a date as 'HH:MM'.
 */
export function formatTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a date as 'DD MMM YYYY' (e.g., '29 avr. 2026').
 */
export function formatDateLong(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
