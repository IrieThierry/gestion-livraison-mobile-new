import {
  dateHeure,
  heure,
  libelleStatutCommande,
  libelleStatutRemise,
  lignesSaisies,
  lireQuantite,
  nomPersonne,
  produitsAAjouter,
  remiseAnnulable,
  resumeLignes,
} from './regles';

describe('Espace commis : règles de saisie', () => {
  it('quantité : vide ou 0 → 0, entier positif lu, autre saisie invalide', () => {
    expect(lireQuantite('')).toBe(0);
    expect(lireQuantite('  ')).toBe(0);
    expect(lireQuantite('0')).toBe(0);
    expect(lireQuantite(' 12 ')).toBe(12);
    expect(lireQuantite('1.5')).toBeNull();
    expect(lireQuantite('-3')).toBeNull();
    expect(lireQuantite('abc')).toBeNull();
  });

  it('lignes saisies : quantités 0 ou vides ignorées, ordre conservé, saisies invalides signalées', () => {
    expect(lignesSaisies({ pf1: '6', pf2: '', pf3: '0', pf4: '12' }, ['pf1', 'pf2', 'pf3', 'pf4'])).toEqual({
      lignes: [
        { produitFournisseurId: 'pf1', quantite: 6 },
        { produitFournisseurId: 'pf4', quantite: 12 },
      ],
      invalides: [],
    });
    expect(lignesSaisies({}, ['pf1'])).toEqual({ lignes: [], invalides: [] });
    expect(lignesSaisies({ pf1: '2,5', pf2: '3' }, ['pf1', 'pf2'])).toEqual({
      lignes: [{ produitFournisseurId: 'pf2', quantite: 3 }],
      invalides: ['pf1'],
    });
  });

  it('résumé de confirmation : une ligne par produit', () => {
    const noms = new Map([
      ['pf1', 'Riz 25 kg'],
      ['pf2', 'Huile 5 L'],
    ]);
    expect(
      resumeLignes(
        [
          { produitFournisseurId: 'pf1', quantite: 6 },
          { produitFournisseurId: 'pf2', quantite: 4 },
        ],
        noms,
      ),
    ).toBe('6 × Riz 25 kg\n4 × Huile 5 L');
  });

  it('produits à ajouter : ceux du catalogue absents de la saisie', () => {
    const catalogue = [
      { produitFournisseurId: 'pf1', produitId: 'p1', designation: 'Riz', photoUrl: null },
      { produitFournisseurId: 'pf2', produitId: 'p2', designation: 'Huile', photoUrl: null },
    ];
    expect(produitsAAjouter(catalogue, ['pf1']).map((p) => p.produitFournisseurId)).toEqual(['pf2']);
  });

  it('date et heure affichées (heure locale du back, sans fuseau)', () => {
    expect(dateHeure('2026-10-17T10:30:00')).toBe('17/10/2026 10:30');
    expect(dateHeure('2026-01-05T08:05:59.123')).toBe('05/01/2026 08:05');
    expect(heure('2026-10-17T08:15:00')).toBe('08:15');
    expect(dateHeure('')).toBe('');
  });

  it('libellés, nom, remise annulable seulement en attente', () => {
    expect(libelleStatutRemise('EN_ATTENTE')).toBe('En attente de confirmation');
    expect(libelleStatutRemise('CONFIRMEE')).toBe('Confirmée');
    expect(libelleStatutRemise('REFUSEE')).toBe('Refusée');
    expect(libelleStatutRemise('ANNULEE')).toBe('Annulée');
    expect(libelleStatutCommande('CONFIRMEE')).toBe('Confirmée');
    expect(libelleStatutCommande('EN_RECEPTION')).toBe('En réception');
    expect(libelleStatutCommande('LIVREE')).toBe('Livrée');
    expect(nomPersonne({ prenom: 'Jean', nom: 'KOUA' })).toBe('Jean KOUA');
    expect(remiseAnnulable({ statut: 'EN_ATTENTE' })).toBe(true);
    for (const s of ['CONFIRMEE', 'REFUSEE', 'ANNULEE'] as const) expect(remiseAnnulable({ statut: s })).toBe(false);
  });
});
