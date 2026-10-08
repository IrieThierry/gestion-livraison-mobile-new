import {
  isAEncaisser,
  isEncaissee,
  isEntierementPayee,
  libelleStatutEncaissement,
} from './livraison-status';
import type { LivraisonResponse } from '../types/api';

const avec = (
  statutEncaissement: LivraisonResponse['statutEncaissement'],
  statut = 'LIVREE',
  over: Partial<LivraisonResponse> = {},
) => ({ statutEncaissement, statut, ...over }) as unknown as LivraisonResponse;

/** Séparateur de milliers fr-FR (espace fine insécable) ramené à un espace. */
const espaces = (s: string) => s.replace(/\s/g, ' ');

describe('statut d’encaissement (statutEncaissement seul)', () => {
  it('ENCAISSEE → encaissée', () => {
    expect(isEncaissee(avec('ENCAISSEE'))).toBe(true);
  });

  it('NON_ENCAISSEE → non encaissée', () => {
    expect(isEncaissee(avec('NON_ENCAISSEE'))).toBe(false);
  });

  it('aucun repli sur `statut` : champ absent = non encaissée, même si statut vaut ENCAISSEE', () => {
    expect(isEncaissee(avec(undefined, 'ENCAISSEE'))).toBe(false);
  });

  it('une valeur inconnue (ex. ancien PARTIELLEMENT) n’est pas encaissée', () => {
    expect(isEncaissee(avec('PARTIELLEMENT' as never))).toBe(false);
  });
});

describe('entièrement payée (entierementPayee, jamais le statut)', () => {
  it('ENCAISSEE avec un reste dû → encore à encaisser (E8)', () => {
    const l = avec('ENCAISSEE', 'LIVREE', { entierementPayee: false, resteDu: 500 });
    expect(isEntierementPayee(l)).toBe(false);
    expect(isAEncaisser(l)).toBe(true);
  });

  it('entierementPayee → plus à encaisser', () => {
    const l = avec('ENCAISSEE', 'LIVREE', { entierementPayee: true, resteDu: 0 });
    expect(isEntierementPayee(l)).toBe(true);
    expect(isAEncaisser(l)).toBe(false);
  });

  it('dû nul (resteDu 0, jamais payée) → rien à encaisser', () => {
    const l = avec('NON_ENCAISSEE', 'LIVREE', { entierementPayee: false, resteDu: 0 });
    expect(isAEncaisser(l)).toBe(false);
  });

  it('resteDu en chaîne > 0 → à encaisser', () => {
    const l = avec('ENCAISSEE', 'LIVREE', { entierementPayee: false, resteDu: '500.00' as never });
    expect(isAEncaisser(l)).toBe(true);
  });

  it('champ absent → à encaisser', () => {
    expect(isAEncaisser(avec('ENCAISSEE'))).toBe(true);
  });
});

describe('libelleStatutEncaissement (badge à deux états + reste dû)', () => {
  it('Encaissée · reste 500', () => {
    expect(libelleStatutEncaissement(avec('ENCAISSEE', 'LIVREE', { resteDu: 500 }))).toBe(
      'Encaissée · reste 500',
    );
  });
  it('Encaissée · reste 0', () => {
    expect(libelleStatutEncaissement(avec('ENCAISSEE', 'LIVREE', { resteDu: 0 }))).toBe(
      'Encaissée · reste 0',
    );
  });
  it('Non encaissée · reste 2 500', () => {
    expect(
      espaces(libelleStatutEncaissement(avec('NON_ENCAISSEE', 'LIVREE', { resteDu: 2500 }))),
    ).toBe('Non encaissée · reste 2 500');
  });
});
