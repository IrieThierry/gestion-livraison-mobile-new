import { formatFCFA, formatMontant, formatDateShort, formatTime, formatDateLong } from './format';

describe('formatMontant', () => {
  it('garde jusqu’à 2 décimales', () => {
    expect(formatMontant(1500.5)).toMatch(/^1[\s  ]500,5$/);
    expect(formatMontant(12.345)).toMatch(/^12,35$|^12,34$/);
  });
  it('conserve le signe et gère null / chaîne', () => {
    expect(formatMontant(-300)).toMatch(/^-300$|^−300$/);
    expect(formatMontant(null)).toBe('0');
    expect(formatMontant('250.5' as unknown as number)).toBe('250,5');
  });
});

describe('formatFCFA', () => {
  it('formats positive integers with French locale (space-like thousand separator)', () => {
    expect(formatFCFA(42350)).toMatch(/42[\s  ]350/);
  });

  it('returns "0" for null', () => {
    expect(formatFCFA(null)).toBe('0');
  });

  it('returns "0" for undefined', () => {
    expect(formatFCFA(undefined)).toBe('0');
  });

  it('handles 0 correctly', () => {
    expect(formatFCFA(0)).toBe('0');
  });

  it('rounds non-integer values', () => {
    expect(formatFCFA(1234.7)).toMatch(/1[\s  ]235/);
    expect(formatFCFA(1234.4)).toMatch(/1[\s  ]234/);
  });

  it('handles negative numbers', () => {
    expect(formatFCFA(-500)).toMatch(/^-500$|^−500$/);
  });

  it('handles large numbers', () => {
    expect(formatFCFA(1_000_000)).toMatch(/1[\s  ]000[\s  ]000/);
  });
});

describe('formatDateShort', () => {
  it('formats an ISO date string in French short form', () => {
    // Build a stable local date (29 April) regardless of timezone
    const result = formatDateShort('2026-04-29T12:00:00Z');
    expect(result).toMatch(/29 avr/);
  });

  it('parses the back format without offset (local time)', () => {
    expect(formatDateShort('2026-10-02T00:00:00')).toMatch(/2 oct/);
  });

  it('accepts a Date object', () => {
    const d = new Date(2026, 3, 29); // month is 0-indexed → April
    expect(formatDateShort(d)).toMatch(/29 avr/);
  });
});

describe('formatTime', () => {
  it('formats a Date as HH:MM', () => {
    const d = new Date(2026, 3, 29, 14, 35);
    // Locale-stable: must contain '14' or '14:35' depending on ICU
    expect(formatTime(d)).toMatch(/14[: ]?35/);
  });
});

describe('formatDateLong', () => {
  it('formats with day, abbreviated month, year', () => {
    const d = new Date(2026, 3, 29);
    const result = formatDateLong(d);
    expect(result).toMatch(/29 avr/);
    expect(result).toMatch(/2026/);
  });
});
