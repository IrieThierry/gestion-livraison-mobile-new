import { joindreIds, selectionValide, validerVersement } from './regles';
import { commandeFixture } from '../commandes/commande.fixture';

describe('joindreIds', () => {
  it('sépare les identifiants par des virgules (format lu par le back)', () => {
    expect(joindreIds(['a', 'b'])).toEqual({ commandeIds: 'a,b' });
  });
  it("omet le paramètre quand aucune commande n'est cochée (versement libre)", () => {
    expect(joindreIds([])).toEqual({});
  });
});

describe('validerVersement', () => {
  const base = { fournisseurId: 'f-1' };

  it('exige un fournisseur', () => {
    expect(validerVersement({ fournisseurId: '', montant: '10', nbCommandes: 1 })).not.toBeNull();
  });

  it('refuse un montant vide, invalide ou négatif', () => {
    expect(validerVersement({ ...base, montant: '', nbCommandes: 1 })).not.toBeNull();
    expect(validerVersement({ ...base, montant: 'abc', nbCommandes: 1 })).not.toBeNull();
    expect(validerVersement({ ...base, montant: '-5', nbCommandes: 1 })).not.toBeNull();
  });

  it('avec des commandes cochées : montant 0 accepté (règlement à crédit)', () => {
    expect(validerVersement({ ...base, montant: '0', nbCommandes: 2 })).toBeNull();
  });

  it('sans commande (versement libre) : montant strictement positif', () => {
    expect(validerVersement({ ...base, montant: '0', nbCommandes: 0 })).toMatch(/libre/i);
    expect(validerVersement({ ...base, montant: '2000', nbCommandes: 0 })).toBeNull();
  });
});

describe('selectionValide', () => {
  const a = commandeFixture({ id: 'a', statut: 'LIVREE' });
  const b = commandeFixture({ id: 'b', statut: 'LIVREE' });

  it('retire les identifiants qui ne sont plus dans la liste (réglés ailleurs)', () => {
    const r = selectionValide(new Set(['a', 'fantome']), [a, b]);
    expect([...r]).toEqual(['a']);
  });

  it('garde les identifiants présents', () => {
    expect([...selectionValide(new Set(['a', 'b']), [a, b])].sort()).toEqual(['a', 'b']);
  });

  it('une liste vide donne une sélection vide', () => {
    expect(selectionValide(new Set(['a']), []).size).toBe(0);
  });
});
