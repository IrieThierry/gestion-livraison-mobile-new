import {
  comptesAvecDemande,
  estEnAttente,
  libelleDemandesMotDePasse,
  nbDemandesMotDePasse,
} from './regles';

const demande = (compteId: string, statut?: 'EN_ATTENTE' | 'TRAITEE' | 'ANNULEE') => ({
  id: `d-${compteId}`,
  compteId,
  statut,
});

describe('demandes « Mot de passe oublié » (M1)', () => {
  it('en attente : sans statut ou EN_ATTENTE', () => {
    expect(estEnAttente({})).toBe(true);
    expect(estEnAttente({ statut: 'EN_ATTENTE' })).toBe(true);
    expect(estEnAttente({ statut: 'TRAITEE' })).toBe(false);
    expect(estEnAttente({ statut: 'ANNULEE' })).toBe(false);
  });

  it('comptes avec une demande en attente et nombre', () => {
    const liste = [demande('a1'), demande('a2', 'EN_ATTENTE'), demande('a3', 'TRAITEE')];
    expect([...comptesAvecDemande(liste)]).toEqual(['a1', 'a2']);
    expect(nbDemandesMotDePasse(liste)).toBe(2);
    expect(nbDemandesMotDePasse(undefined)).toBe(0);
    expect(comptesAvecDemande(undefined).size).toBe(0);
  });

  it('libellé de la ligne « À traiter »', () => {
    expect(libelleDemandesMotDePasse(1)).toBe('1 demande de mot de passe');
    expect(libelleDemandesMotDePasse(3)).toBe('3 demandes de mot de passe');
  });
});
