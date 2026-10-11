import { assainirSegment, ENTITE_EQUIPE, ENTITE_TOUS, nomFichierEtat } from './nomFichier';

const periode = { debut: '2026-10-01', fin: '2026-10-31' };

describe('assainirSegment', () => {
  it('retire les accents et remplace espaces et apostrophes', () => {
    expect(assainirSegment('Kouassi Jean')).toBe('Kouassi-Jean');
    expect(assainirSegment('Éloïse N’Guessan')).toBe('Eloise-N-Guessan');
    expect(assainirSegment("Lait d'Ivoire")).toBe('Lait-d-Ivoire');
  });

  it('fusionne les tirets et les retire en début et fin', () => {
    expect(assainirSegment('  --Pain / Beurre (1 kg)-- ')).toBe('Pain-Beurre-1-kg');
    expect(assainirSegment(null)).toBe('');
  });
});

describe('nomFichierEtat', () => {
  it('filtre client : Type_Client_debut_au_fin', () => {
    expect(
      nomFichierEtat({ famille: 'ventes', periode, entites: ['Kouassi Jean'], livreur: 'Awa Koné' }),
    ).toBe('Ventes_Kouassi-Jean_2026-10-01_au_2026-10-31');
  });

  it('plusieurs filtres joints par « _ » dans l’ordre client, produit, fournisseur', () => {
    expect(
      nomFichierEtat({
        famille: 'ventes',
        periode,
        entites: ['Kouassi Jean', 'Pain de mie', null],
        livreur: 'Awa',
      }),
    ).toBe('Ventes_Kouassi-Jean_Pain-de-mie_2026-10-01_au_2026-10-31');
  });

  it('sans filtre : le nom du livreur choisi', () => {
    expect(nomFichierEtat({ famille: 'encaissements', periode, livreur: 'Awa Koné' })).toBe(
      'Encaissements-Creances_Awa-Kone_2026-10-01_au_2026-10-31',
    );
  });

  it('vue équipe et tous les livreurs', () => {
    expect(nomFichierEtat({ famille: 'stock', periode, entites: [], livreur: ENTITE_EQUIPE })).toBe(
      'Stock-Mouvements_Equipe_2026-10-01_au_2026-10-31',
    );
    expect(nomFichierEtat({ famille: 'fournisseurs', periode, livreur: ENTITE_TOUS })).toBe(
      'Fournisseurs-Versements_Tous-les-livreurs_2026-10-01_au_2026-10-31',
    );
  });
});
