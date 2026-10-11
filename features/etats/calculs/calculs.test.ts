import { arrondi, dansPeriode, jourDe, somme } from './commun';
import { calculerEtatVentes } from './ventes';
import { calculerEtatEncaissements } from './encaissements';
import { calculerEtatStock, detailMouvement, lignesDepuisActuel, lignesDepuisEquipe } from './stock';
import { calculerEtatFournisseurs } from './fournisseurs';
import {
  PERIODE_OCTOBRE as P,
  commande,
  encaissement,
  encours,
  ligneLivraison,
  livraison,
  mouvement,
  partenaire,
  versement,
} from './etats.fixture';
import type { StockEquipeLigneResponse, StockLivreurResponse } from '../../../types/api';

describe('commun', () => {
  it('arrondit au centime sans -0', () => {
    expect(arrondi(0.1 + 0.2)).toBe(0.3);
    expect(arrondi(-0.001)).toBe(0);
    expect(Object.is(arrondi(-0.001), -0)).toBe(false);
    expect(arrondi('1500.555' as unknown as number)).toBe(1500.56);
  });

  it('somme des valeurs, chaînes BigDecimal comprises', () => {
    expect(somme([{ v: '10.10' }, { v: 20.2 }, { v: null }], (x) => x.v)).toBe(30.3);
  });

  it('jour d’une date locale du back sans décalage de fuseau', () => {
    expect(jourDe('2026-10-31T23:59:59')).toBe('2026-10-31');
    expect(jourDe('2026-10-01')).toBe('2026-10-01');
    expect(jourDe(null)).toBeNull();
    expect(jourDe('n’importe quoi')).toBeNull();
  });

  it('période en jours entiers, bornes incluses', () => {
    expect(dansPeriode('2026-10-01T00:00:00', P)).toBe(true);
    expect(dansPeriode('2026-10-31T23:59:59', P)).toBe(true);
    expect(dansPeriode('2026-09-30T23:59:59', P)).toBe(false);
    expect(dansPeriode('2026-11-01T00:00:00', P)).toBe(false);
    expect(dansPeriode(undefined, P)).toBe(false);
  });
});

describe('calculerEtatVentes', () => {
  const livraisons = [
    livraison({
      id: '2',
      date: '2026-10-05T10:00:00',
      clientId: 'c1',
      client: 'Ali Traore',
      montantDu: 2700,
      remiseNette: -300,
      lignes: [ligneLivraison('p1', 'Eau', 10, 1, 350, -50)],
    }),
    livraison({
      id: '1',
      date: '2026-10-02T09:00:00',
      clientId: 'c2',
      client: 'Binta Diallo',
      montantDu: 1000.1,
      lignes: [ligneLivraison('p2', 'Biscuit', 4, 0, 250.025), ligneLivraison('p1', 'Eau', 2, 0, 300)],
    }),
    livraison({
      id: '3',
      date: '2026-10-20T08:00:00',
      clientId: 'c1',
      client: 'Ali Traore',
      montantDu: 600.2,
      lignes: [],
    }),
    // Hors période : écartée.
    livraison({ id: '0', date: '2026-09-30T18:00:00', clientId: 'c1', client: 'Ali Traore', montantDu: 9999 }),
  ];

  it('liste les livraisons de la période, de la plus ancienne à la plus récente', () => {
    const etat = calculerEtatVentes(livraisons, P);
    expect(etat.livraisons.map((l) => l.reference)).toEqual(['LIV-1', 'LIV-2', 'LIV-3']);
    expect(etat.livraisons[1]).toMatchObject({ client: 'Ali Traore', montantDu: 2700, remise: -300 });
  });

  it('cumule par client (tri par montant dû décroissant)', () => {
    const etat = calculerEtatVentes(livraisons, P);
    expect(etat.parClient).toEqual([
      { clientId: 'c1', client: 'Ali Traore', nbLivraisons: 2, montantDu: 3300.2, remise: -300 },
      { clientId: 'c2', client: 'Binta Diallo', nbLivraisons: 1, montantDu: 1000.1, remise: 0 },
    ]);
  });

  it('cumule par produit : livrée, retournée, vendue et montant (prix + remise) × vendue', () => {
    const etat = calculerEtatVentes(livraisons, P);
    expect(etat.parProduit).toEqual([
      { produitId: 'p2', designation: 'Biscuit', qteLivree: 4, qteRetournee: 0, qteVendue: 4, montant: 1000.1 },
      { produitId: 'p1', designation: 'Eau', qteLivree: 12, qteRetournee: 1, qteVendue: 11, montant: 3300 },
    ]);
  });

  it('totaux arrondis au centime', () => {
    const t = calculerEtatVentes(livraisons, P).totaux;
    expect(t).toEqual({
      nbLivraisons: 3,
      montantDu: 4300.3,
      remise: -300,
      qteLivree: 16,
      qteRetournee: 1,
      qteVendue: 15,
      montantProduits: 4300.1,
    });
  });

  it('période vide : état vide sans erreur', () => {
    const etat = calculerEtatVentes([], P);
    expect(etat.livraisons).toEqual([]);
    expect(etat.parClient).toEqual([]);
    expect(etat.parProduit).toEqual([]);
    expect(etat.totaux.montantDu).toBe(0);
    expect(etat.totaux.nbLivraisons).toBe(0);
  });
});

describe('calculerEtatEncaissements', () => {
  const encs = [
    encaissement({ id: 'b', date: '2026-10-12T10:00:00', client: 'Ali Traore', montant: 1500.5, ecart: -200 }),
    encaissement({ id: 'a', date: '2026-10-03T10:00:00', client: 'Binta Diallo', montant: 2000, ecart: 100.25 }),
    encaissement({ id: 'z', date: '2026-11-01T00:00:00', client: 'Ali Traore', montant: 5000 }),
  ];
  const soldes = [encours('c1', 'Ali Traore', 3000), encours('c2', 'Binta Diallo', -500), encours('c3', 'Cheick Sy', 0), encours('c4', 'Dado Ba', 1200.4)];

  it('garde les encaissements de la période, filtrés sur dateEncaissement', () => {
    const etat = calculerEtatEncaissements(encs, soldes, P);
    expect(etat.encaissements.map((e) => e.reference)).toEqual(['ENC-a', 'ENC-b']);
    expect(etat.totaux.montantEncaisse).toBe(3500.5);
    expect(etat.totaux.ecart).toBe(-99.75);
    expect(etat.totaux.nbEncaissements).toBe(2);
  });

  it('créances : solde actuel des clients non soldés, dû et avances séparés', () => {
    const etat = calculerEtatEncaissements(encs, soldes, P);
    expect(etat.creances.map((c) => [c.client, c.solde])).toEqual([
      ['Ali Traore', 3000],
      ['Dado Ba', 1200.4],
      ['Binta Diallo', -500],
    ]);
    expect(etat.totaux.totalDu).toBe(4200.4);
    expect(etat.totaux.totalAvances).toBe(500);
    expect(etat.totaux.soldeNet).toBe(3700.4);
  });

  it('période vide : aucun encaissement, totaux à zéro', () => {
    const etat = calculerEtatEncaissements([], [], P);
    expect(etat.encaissements).toEqual([]);
    expect(etat.creances).toEqual([]);
    expect(etat.totaux).toEqual({
      nbEncaissements: 0,
      montantEncaisse: 0,
      ecart: 0,
      totalDu: 0,
      totalAvances: 0,
      soldeNet: 0,
    });
  });
});

describe('calculerEtatStock', () => {
  const mouvements = [
    mouvement('RECEPTION', '2026-10-02T08:00:00', 24, 'Eau', 'REC-1'),
    mouvement('LIVRAISON', '2026-10-03T09:00:00', -10, 'Eau', 'LIV-1', 'Ali Traore'),
    mouvement('RETOUR_EN_STOCK', '2026-10-04T09:00:00', 2, 'Eau', 'LIV-1'),
    mouvement('TRANSFERT_SORTIE', '2026-10-05T09:00:00', -3, 'Biscuit', 'TRF-1', 'Moussa'),
    mouvement('AJUSTEMENT', '2026-10-06T09:00:00', -13, 'Eau', 'Périmé', 'Lot abîmé'),
    mouvement('RECEPTION', '2026-09-28T08:00:00', 50, 'Eau'),
  ];

  it('stock courant cumulé par produit (lignes à zéro écartées)', () => {
    const actuel = [
      { produit: { id: 'p1', designation: 'Eau' }, qte: 5 },
      { produit: { id: 'p2', designation: 'Biscuit' }, qte: 0 },
      { produit: { id: 'p1', designation: 'Eau' }, qte: 3 },
    ];
    const etat = calculerEtatStock(actuel, [], P);
    expect(etat.stock).toEqual([{ produitId: 'p1', designation: 'Eau', qte: 8 }]);
    expect(etat.totaux.qteStock).toBe(8);
  });

  it('mouvements de la période par type, ajustement compté en sortie', () => {
    const etat = calculerEtatStock([], mouvements, P);
    expect(etat.mouvements).toHaveLength(5);
    expect(etat.parType).toEqual([
      { type: 'RECEPTION', libelle: 'Réception', nb: 1, entrees: 24, sorties: 0, net: 24 },
      { type: 'LIVRAISON', libelle: 'Livraison', nb: 1, entrees: 0, sorties: 10, net: -10 },
      { type: 'RETOUR_EN_STOCK', libelle: 'Retour en stock', nb: 1, entrees: 2, sorties: 0, net: 2 },
      { type: 'TRANSFERT_SORTIE', libelle: 'Transfert envoyé', nb: 1, entrees: 0, sorties: 3, net: -3 },
      { type: 'AJUSTEMENT', libelle: 'Ajustement', nb: 1, entrees: 0, sorties: 13, net: -13 },
    ]);
    expect(etat.totaux).toMatchObject({ nbMouvements: 5, entrees: 26, sorties: 26, net: 0 });
  });

  it('un ajustement affiche « Ajustement » et le motif', () => {
    const etat = calculerEtatStock([], mouvements, P);
    const aj = etat.mouvements.find((m) => m.type === 'AJUSTEMENT')!;
    expect(aj.libelleType).toBe('Ajustement');
    expect(aj.detail).toBe('Motif : Périmé (Lot abîmé)');
    expect(aj.quantite).toBe(-13);
    expect(detailMouvement({ type: 'AJUSTEMENT', reference: 'Casse', contrepartie: null })).toBe('Motif : Casse');
    expect(detailMouvement({ type: 'LIVRAISON', reference: 'LIV-1', contrepartie: 'Ali' })).toBe('LIV-1 · Ali');
  });

  it('reprend le livreur des mouvements en vue équipe', () => {
    const etat = calculerEtatStock([], [{ ...mouvements[0], livreur: 'Moussa Kone' }], P);
    expect(etat.mouvements[0].livreur).toBe('Moussa Kone');
  });

  it('sources : /actuel et /equipe', () => {
    const actuel = [{ produit: { id: 'p1', designation: 'Eau' }, qte: 4 }] as unknown as StockLivreurResponse[];
    const equipe = [{ produit: { id: 'p1', designation: 'Eau' }, totalQte: 9 }] as unknown as StockEquipeLigneResponse[];
    expect(lignesDepuisActuel(actuel)).toEqual([{ produit: { id: 'p1', designation: 'Eau' }, qte: 4 }]);
    expect(lignesDepuisEquipe(equipe)).toEqual([{ produit: { id: 'p1', designation: 'Eau' }, qte: 9 }]);
  });

  it('période vide : aucun mouvement, aucun type', () => {
    const etat = calculerEtatStock([], [], P);
    expect(etat.parType).toEqual([]);
    expect(etat.totaux).toEqual({ qteStock: 0, nbMouvements: 0, entrees: 0, sorties: 0, net: 0 });
  });
});

describe('calculerEtatFournisseurs', () => {
  const partenaires = [
    partenaire('f1', 'Brasserie', 150000.5, 2000),
    partenaire('f2', 'Biscuiterie', -500, 0),
    partenaire('f3', 'En attente', null, null, 'EN_ATTENTE'),
  ];
  const commandes = [
    commande({
      id: '1',
      date: '2026-10-03T08:00:00',
      fournisseurId: 'f1',
      fournisseur: 'Brasserie',
      montantLivre: 12000,
      receptions: [
        { date: '2026-10-04T08:00:00', lignes: [[10, 1000, 50], [2, 1000, 0]] },
        { date: '2026-10-05T08:00:00', annulee: true, lignes: [[99, 1000, 0]] },
      ],
    }),
    // Commandée en septembre, reçue en octobre : la réception compte.
    commande({
      id: '0',
      date: '2026-09-25T08:00:00',
      fournisseurId: 'f2',
      fournisseur: 'Biscuiterie',
      montantLivre: 3000,
      receptions: [
        { date: '2026-09-28T08:00:00', lignes: [[1, 1000, 0]] },
        { date: '2026-10-02T08:00:00', lignes: [[4, 500, 10]] },
      ],
    }),
  ];
  const versements = [
    versement({ id: 'v1', date: '2026-10-10T08:00:00', fournisseurId: 'f1', fournisseur: 'Brasserie', montant: 8000, detteApres: 4000 }),
    versement({ id: 'v0', date: '2026-09-10T08:00:00', fournisseurId: 'f1', fournisseur: 'Brasserie', montant: 1 }),
  ];

  it('réceptions de la période sur la date de réception, annulées écartées', () => {
    const etat = calculerEtatFournisseurs(partenaires, commandes, versements, P);
    expect(etat.receptions).toEqual([
      { date: '2026-10-02T08:00:00', reference: 'REC-0-1', commande: 'CMD-0', fournisseur: 'Biscuiterie', montant: 2000, remise: 40 },
      { date: '2026-10-04T08:00:00', reference: 'REC-1-0', commande: 'CMD-1', fournisseur: 'Brasserie', montant: 12000, remise: 500 },
    ]);
  });

  it('commandes et versements filtrés sur leur date', () => {
    const etat = calculerEtatFournisseurs(partenaires, commandes, versements, P);
    expect(etat.commandes.map((c) => [c.reference, c.statut, c.montantRecu])).toEqual([['CMD-1', 'Livrée', 12000]]);
    expect(etat.versements).toEqual([
      { id: 'v1', date: '2026-10-10T08:00:00', fournisseur: 'Brasserie', montantVerse: 8000, detteApres: 4000 },
    ]);
  });

  it('par fournisseur partenaire : dû et remise actuels, reçu et versé de la période', () => {
    const etat = calculerEtatFournisseurs(partenaires, commandes, versements, P);
    expect(etat.parFournisseur).toEqual([
      { fournisseurId: 'f2', fournisseur: 'Biscuiterie', nbCommandes: 0, montantRecu: 2000, remiseRecue: 40, montantVerse: 0, du: -500, remiseARecevoir: 0 },
      { fournisseurId: 'f1', fournisseur: 'Brasserie', nbCommandes: 1, montantRecu: 12000, remiseRecue: 500, montantVerse: 8000, du: 150000.5, remiseARecevoir: 2000 },
    ]);
    expect(etat.totaux).toEqual({
      nbCommandes: 1,
      montantCommandes: 12000,
      montantRecu: 14000,
      remiseRecue: 540,
      montantVerse: 8000,
      du: 149500.5,
      remiseARecevoir: 2000,
    });
  });

  it('période vide : tableaux vides, seuls les partenaires restent', () => {
    const etat = calculerEtatFournisseurs([], [], [], P);
    expect(etat.parFournisseur).toEqual([]);
    expect(etat.totaux.montantRecu).toBe(0);
  });
});

describe('filtres des états', () => {
  const livraisons = [
    livraison({
      id: '1',
      date: '2026-10-02T09:00:00',
      clientId: 'c1',
      client: 'Ali Traore',
      montantDu: 5000,
      remiseNette: -500,
      lignes: [ligneLivraison('p1', 'Eau', 10, 2, 300, -50), ligneLivraison('p2', 'Jus', 5, 0, 600)],
    }),
    livraison({
      id: '2',
      date: '2026-10-03T09:00:00',
      clientId: 'c2',
      client: 'Binta Diallo',
      montantDu: 1200,
      lignes: [ligneLivraison('p2', 'Jus', 2, 0, 600)],
    }),
  ];

  it('ventes, client : seules les livraisons de ce client', () => {
    const e = calculerEtatVentes(livraisons, P, { clientId: 'c2' });
    expect(e.livraisons.map((l) => l.id)).toEqual(['2']);
    expect(e.parClient.map((c) => c.clientId)).toEqual(['c2']);
    expect(e.parProduit.map((p) => p.produitId)).toEqual(['p2']);
    expect(e.totaux.montantDu).toBe(1200);
  });

  it('ventes, produit : livraisons contenant le produit, montants limités à ses lignes', () => {
    const e = calculerEtatVentes(livraisons, P, { produitId: 'p1' });
    expect(e.livraisons.map((l) => l.id)).toEqual(['1']);
    // (300 − 50) × (10 − 2) = 2000 ; remise −50 × 8 = −400
    expect(e.livraisons[0]).toMatchObject({ montantDu: 2000, remise: -400 });
    expect(e.parClient).toEqual([
      { clientId: 'c1', client: 'Ali Traore', nbLivraisons: 1, montantDu: 2000, remise: -400 },
    ]);
    expect(e.parProduit.map((p) => p.produitId)).toEqual(['p1']);
    expect(e.totaux).toMatchObject({ nbLivraisons: 1, montantDu: 2000, remise: -400, qteVendue: 8, montantProduits: 2000 });
  });

  it('ventes, client et produit combinés', () => {
    expect(calculerEtatVentes(livraisons, P, { clientId: 'c2', produitId: 'p1' }).livraisons).toEqual([]);
    const e = calculerEtatVentes(livraisons, P, { clientId: 'c1', produitId: 'p2' });
    expect(e.totaux).toMatchObject({ nbLivraisons: 1, montantDu: 3000, qteVendue: 5 });
  });

  it('encaissements, client : encaissements et créances de ce client', () => {
    const e = calculerEtatEncaissements(
      [
        encaissement({ id: 'e1', date: '2026-10-02T10:00:00', client: 'Ali Traore', montant: 1000 }),
        encaissement({ id: 'e2', date: '2026-10-03T10:00:00', client: 'Binta Diallo', montant: 700 }),
      ],
      [encours('c-Ali Traore', 'Ali Traore', 500), encours('c-Binta Diallo', 'Binta Diallo', 300)],
      P,
      { clientId: 'c-Binta Diallo' },
    );
    expect(e.encaissements.map((x) => x.id)).toEqual(['e2']);
    expect(e.creances.map((c) => c.clientId)).toEqual(['c-Binta Diallo']);
    expect(e.totaux).toMatchObject({ montantEncaisse: 700, totalDu: 300 });
  });

  it('stock, produit et type de mouvement', () => {
    const stock = lignesDepuisActuel([
      { produit: { id: 'p-Eau 1,5 L', designation: 'Eau 1,5 L' }, qte: 10 },
      { produit: { id: 'p-Jus', designation: 'Jus' }, qte: 4 },
    ] as unknown as StockLivreurResponse[]);
    const mvts = [
      mouvement('RECEPTION', '2026-10-02T08:00:00', 20),
      mouvement('LIVRAISON', '2026-10-02T10:00:00', -5),
      mouvement('LIVRAISON', '2026-10-02T11:00:00', -3, 'Jus'),
    ];
    const parProduit = calculerEtatStock(stock, mvts, P, { produitId: 'p-Jus' });
    expect(parProduit.stock.map((s) => s.produitId)).toEqual(['p-Jus']);
    expect(parProduit.mouvements.map((m) => m.produit)).toEqual(['Jus']);

    const parType = calculerEtatStock(stock, mvts, P, { typeMouvement: 'LIVRAISON' });
    expect(parType.stock).toHaveLength(2);
    expect(parType.mouvements.map((m) => m.type)).toEqual(['LIVRAISON', 'LIVRAISON']);
    expect(parType.totaux).toMatchObject({ nbMouvements: 2, entrees: 0, sorties: 8 });

    const combines = calculerEtatStock(stock, mvts, P, { produitId: 'p-Eau 1,5 L', typeMouvement: 'RECEPTION' });
    expect(combines.mouvements.map((m) => m.quantite)).toEqual([20]);
  });

  it('fournisseurs, fournisseur : tout l’état limité à ce fournisseur', () => {
    const e = calculerEtatFournisseurs(
      [partenaire('f1', 'Brasserie', 1000, 0), partenaire('f2', 'Laiterie', 500, 0)],
      [
        commande({ id: 'k1', date: '2026-10-02T08:00:00', fournisseurId: 'f1', fournisseur: 'Brasserie', receptions: [{ date: '2026-10-03T08:00:00', lignes: [[2, 100, 0]] }] }),
        commande({ id: 'k2', date: '2026-10-02T08:00:00', fournisseurId: 'f2', fournisseur: 'Laiterie' }),
      ],
      [
        versement({ id: 'v1', date: '2026-10-04T08:00:00', fournisseurId: 'f1', fournisseur: 'Brasserie', montant: 150 }),
        versement({ id: 'v2', date: '2026-10-04T08:00:00', fournisseurId: 'f2', fournisseur: 'Laiterie', montant: 90 }),
      ],
      P,
      { fournisseurId: 'f2' },
    );
    expect(e.parFournisseur.map((f) => f.fournisseurId)).toEqual(['f2']);
    expect(e.commandes.map((c) => c.id)).toEqual(['k2']);
    expect(e.receptions).toEqual([]);
    expect(e.versements.map((v) => v.id)).toEqual(['v2']);
    expect(e.totaux).toMatchObject({ nbCommandes: 1, montantVerse: 90, du: 500 });
  });

  it('sans filtre : résultat inchangé', () => {
    expect(calculerEtatVentes(livraisons, P, {})).toEqual(calculerEtatVentes(livraisons, P));
  });
});
