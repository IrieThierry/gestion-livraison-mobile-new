import {
  avecPrixAchat,
  erreurPlancher,
  erreurPlancherLignes,
  indexPrixAchat,
  messagePlancher,
  montantPlancher,
} from './plancher';
import type { PrixAchatProduitResponse } from '../../types/api';

const achat = (produitId: string, designation: string, prixAchat: number): PrixAchatProduitResponse => ({
  produitId,
  designation,
  prixAchat,
  fournisseur: { id: 'f1', libelle: 'Moulin A' },
  detail: [{ fournisseurId: 'f1', libelle: 'Moulin A', prixAchat }],
});

const table = indexPrixAchat([achat('pain', 'Pain', 1500), achat('lait', 'Lait', 250.5)]);

describe('montantPlancher (format du back)', () => {
  it('espace ordinaire pour les milliers, pas de décimales pour un entier', () => {
    expect(montantPlancher(1500)).toBe('1 500');
    expect(montantPlancher(1450)).toBe('1 450');
    expect(montantPlancher(950)).toBe('950');
    expect(montantPlancher(1234567)).toBe('1 234 567');
    expect(montantPlancher('1500.00')).toBe('1 500');
    expect(montantPlancher(0)).toBe('0');
  });

  it('virgule décimale sans zéro inutile', () => {
    expect(montantPlancher(1000.5)).toBe('1 000,5');
    expect(montantPlancher(12500.25)).toBe('12 500,25');
    expect(montantPlancher('250.50')).toBe('250,5');
  });
});

describe('plancher du prix de vente (P5)', () => {
  it('message exact de la spec', () => {
    expect(messagePlancher('Pain', 1450, 1500)).toBe(
      "Le prix de vente de Pain (1 450 F) est inférieur au prix d'achat (1 500 F).",
    );
  });

  it('refus seulement si strictement inférieur', () => {
    expect(erreurPlancher(table, 'pain', 'Pain', 1450)).toBe(
      "Le prix de vente de Pain (1 450 F) est inférieur au prix d'achat (1 500 F).",
    );
    expect(erreurPlancher(table, 'pain', 'Pain', 1500)).toBeNull();
    expect(erreurPlancher(table, 'pain', 'Pain', 1600)).toBeNull();
    expect(erreurPlancher(table, 'lait', 'Lait', 250)).toBe(
      "Le prix de vente de Lait (250 F) est inférieur au prix d'achat (250,5 F).",
    );
  });

  it('pas de contrôle sans prix d’achat connu, sans prix ou sans table', () => {
    expect(erreurPlancher(table, 'sucre', 'Sucre', 1)).toBeNull();
    expect(erreurPlancher(table, 'pain', 'Pain', 0)).toBeNull();
    expect(erreurPlancher(table, 'pain', 'Pain', null)).toBeNull();
    expect(erreurPlancher(undefined, 'pain', 'Pain', 10)).toBeNull();
  });

  it('lignes : la première ligne fautive dans l’ordre donne le message', () => {
    const lignes = [
      { produitId: 'sucre', designation: 'Sucre', prix: 1 },
      { produitId: 'lait', designation: 'Lait', prix: 200 },
      { produitId: 'pain', designation: 'Pain', prix: 1000 },
    ];
    expect(erreurPlancherLignes(table, lignes)).toBe(
      "Le prix de vente de Lait (200 F) est inférieur au prix d'achat (250,5 F).",
    );
    expect(erreurPlancherLignes(table, [{ produitId: 'pain', designation: 'Pain', prix: 1500 }])).toBeNull();
  });

  it('livreur indépendant seulement (principal ou apprenti), pas une organisation', () => {
    expect(avecPrixAchat({ organisationId: null, organisationRole: null })).toBe(true);
    expect(avecPrixAchat({ organisationId: 'o1', organisationRole: 'COMMERCIAL' })).toBe(false);
    expect(avecPrixAchat({ organisationId: 'o1', organisationRole: 'RESPONSABLE' })).toBe(false);
    expect(avecPrixAchat(null)).toBe(false);
  });
});
