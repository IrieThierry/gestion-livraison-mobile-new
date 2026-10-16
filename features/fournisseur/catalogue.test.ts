import type { LigneCatalogueFournisseurResponse, ProduitResponse } from '../../types/api';
import {
  MESSAGE_DESIGNATION,
  MAX_RESULTATS,
  doublonDe,
  erreurDesignation,
  etatProduit,
  filtrerCatalogue,
  lignesParProduit,
  nettoyerDesignation,
  resultatsReferentiel,
  texteReactivation,
} from './catalogue';

const produit = (id: string, designation: string, code = id.toUpperCase()): ProduitResponse => ({ id, code, designation });
const ligne = (id: string, p: ProduitResponse, actif = true): LigneCatalogueFournisseurResponse => ({
  id,
  produit: p,
  prixDeVente: 250,
  actif,
  dateDesactivation: actif ? null : '2026-10-01T00:00:00',
  nbPrixParticuliers: 0,
  renommable: false,
});

const PAIN = produit('p1', 'Pain');
const BAGUETTE = produit('p2', 'Baguette');
const CROISSANT = produit('p3', 'Croissant');

describe('FM3 : catalogue du fournisseur', () => {
  it('filtres Actifs, Inactifs, Tous', () => {
    const lignes = [ligne('a', PAIN), ligne('b', BAGUETTE, false)];
    expect(filtrerCatalogue(lignes, 'actifs').map((l) => l.id)).toEqual(['a']);
    expect(filtrerCatalogue(lignes, 'inactifs').map((l) => l.id)).toEqual(['b']);
    expect(filtrerCatalogue(lignes, 'tous')).toHaveLength(2);
  });

  it('désignation : nettoyée, 2 à 100 caractères, caractères permis', () => {
    expect(nettoyerDesignation('  Pain   maison ')).toBe('Pain maison');
    expect(erreurDesignation('Pain d’épice')).toBeNull();
    expect(erreurDesignation(' P ')).toBe(MESSAGE_DESIGNATION);
    expect(erreurDesignation('Pain #1')).toBe(MESSAGE_DESIGNATION);
    expect(erreurDesignation('x'.repeat(101))).toBe(MESSAGE_DESIGNATION);
  });

  it('référentiel : recherche (désignation ou code), déjà actifs en dernier, inactifs à réactiver', () => {
    const lignes = lignesParProduit([ligne('a', PAIN), ligne('b', BAGUETTE, false)]);
    expect(etatProduit(PAIN, lignes)).toBe('deja');
    expect(etatProduit(BAGUETTE, lignes)).toBe('inactif');
    expect(etatProduit(CROISSANT, lignes)).toBe('libre');
    expect(resultatsReferentiel([PAIN, BAGUETTE, CROISSANT], lignes, '').map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
    expect(resultatsReferentiel([PAIN, BAGUETTE, CROISSANT], lignes, 'croi').map((p) => p.id)).toEqual(['p3']);
    expect(resultatsReferentiel([PAIN, BAGUETTE, CROISSANT], lignes, 'p2').map((p) => p.id)).toEqual(['p2']);
    const beaucoup = Array.from({ length: 60 }, (_, i) => produit(`x${i}`, `Produit ${i}`));
    expect(resultatsReferentiel(beaucoup, lignes, '')).toHaveLength(MAX_RESULTATS);
  });

  it('doublon : même désignation normalisée (casse ignorée, accents conservés)', () => {
    expect(doublonDe([PAIN], '  pain ')).toBe(PAIN);
    expect(doublonDe([PAIN], 'Pâin')).toBeNull();
    expect(doublonDe([PAIN], '')).toBeNull();
  });

  it('réactivation : prix de la ligne conservé', () => {
    expect(texteReactivation(1250)).toMatch(/au prix de 1\s250 F\. Modifie la ligne pour changer ce prix\.$/);
  });
});
