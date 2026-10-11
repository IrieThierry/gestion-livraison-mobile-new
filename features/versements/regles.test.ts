import {
  joindreIds,
  rechercherVersements,
  selectionValide,
  totalVerse,
  trierVersements,
  validerVersement,
  valeurCommande,
} from './regles';
import type { VersementResponse } from '../../types/api';
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

describe('valeurCommande', () => {
  it('prix + remise livreur', () => {
    expect(valeurCommande({ montantLivre: 700, remiseLivreurLivree: 75 })).toBe(775);
  });
  it('sans remise ni montant : 0', () => {
    expect(valeurCommande({ montantLivre: 700, remiseLivreurLivree: null })).toBe(700);
    expect(valeurCommande({ montantLivre: null, remiseLivreurLivree: null })).toBe(0);
  });
});

describe('liste Mes versements', () => {
  const v = (id: string, date: string, fournisseur: string, montant: number | string, commentaire: string | null = null) =>
    ({
      id,
      dateVersement: date,
      fournisseur: { id: `f-${fournisseur}`, libelle: fournisseur },
      montantVerse: montant,
      commentaire,
    }) as unknown as VersementResponse;
  const liste = [
    v('1', '2026-10-02T09:00:00', 'Brasserie du Sud', 15000),
    v('2', '2026-10-05T09:00:00', 'Laiterie Abidjan', '2500.50', 'Solde septembre'),
    v('3', '2026-09-28T09:00:00', 'Brasserie du Sud', 4000),
  ];

  it('tri du plus récent au plus ancien', () => {
    expect(trierVersements(liste).map((x) => x.id)).toEqual(['2', '1', '3']);
  });

  it('recherche sur le fournisseur et le commentaire, sans accents ni casse', () => {
    expect(rechercherVersements(liste, 'brasserie').map((x) => x.id)).toEqual(['1', '3']);
    expect(rechercherVersements(liste, 'SEPTEMBRE').map((x) => x.id)).toEqual(['2']);
    expect(rechercherVersements(liste, '')).toHaveLength(3);
  });

  it('total versé, montants en chaîne compris', () => {
    expect(totalVerse(liste)).toBe(21500.5);
    expect(totalVerse([])).toBe(0);
  });
});
