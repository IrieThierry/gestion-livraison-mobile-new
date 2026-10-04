import { isAEncaisser, isEncaissee } from './livraison-status';
import type { LivraisonResponse } from '../types/api';

const avec = (statutEncaissement: LivraisonResponse['statutEncaissement'], statut = 'LIVREE') =>
  ({ statutEncaissement, statut }) as unknown as LivraisonResponse;

describe('statut d’encaissement (statutEncaissement seul)', () => {
  it('ENCAISSEE → encaissée', () => {
    expect(isEncaissee(avec('ENCAISSEE'))).toBe(true);
    expect(isAEncaisser(avec('ENCAISSEE'))).toBe(false);
  });

  it('NON_ENCAISSEE → à encaisser', () => {
    expect(isEncaissee(avec('NON_ENCAISSEE'))).toBe(false);
    expect(isAEncaisser(avec('NON_ENCAISSEE'))).toBe(true);
  });

  it('aucun repli sur `statut` : champ absent = à encaisser, même si statut vaut ENCAISSEE', () => {
    expect(isEncaissee(avec(undefined, 'ENCAISSEE'))).toBe(false);
    expect(isAEncaisser(avec(undefined, 'ENCAISSEE'))).toBe(true);
  });

  it('une valeur inconnue (ex. ancien PARTIELLEMENT) n’est pas encaissée', () => {
    expect(isEncaissee(avec('PARTIELLEMENT' as never))).toBe(false);
  });
});
