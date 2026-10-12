import type { ClientResponse, LivraisonResponse, PrevisionResponse, ProduitResponse } from '../../types/api';
import {
  ajouterJours,
  ajouterPlusTard,
  appliquerPrevisions,
  cleGroupe,
  cleStockagePlusTard,
  echuesATraiter,
  erreurDatePrevue,
  estEchue,
  formatEcart,
  fusionnerCommentaires,
  marqueReport,
  jourAbrege,
  jourDe,
  joursEchues,
  libelleEnregistrerPour,
  lignesDepuisPrevisions,
  lireMemoirePlusTard,
  parClient,
  parLivreur,
  planCreation,
  planModification,
  planReport,
  prefillCommande,
  prevuLivre,
  regrouperPrevisions,
} from './regles';

const client = (id: string, prenom: string, nom = ''): ClientResponse =>
  ({ id, prenom, nom } as ClientResponse);
const produit = (id: string, designation: string): ProduitResponse => ({ id, code: id, designation });
const livreur = (id: string, prenom = 'Ali', nom = 'K') => ({ id, prenom, nom }) as PrevisionResponse['livreur'];

const AWA = client('c1', 'Awa', 'Traoré');
const BEN = client('c2', 'Ben', 'Koné');
const PAIN = produit('p1', 'Pain');
const CROISSANT = produit('p2', 'Croissant');

let seq = 0;
const prev = (o: Partial<PrevisionResponse> & { qte: number; jour?: string }): PrevisionResponse => ({
  id: o.id ?? `prev-${++seq}`,
  livreur: o.livreur ?? livreur('L1'),
  client: o.client ?? AWA,
  produit: o.produit ?? PAIN,
  qteEstimee: o.qte,
  dateLivraison: `${o.jour ?? '2026-10-12'}T00:00:00`,
  commentaire: o.commentaire ?? null,
});

const liv = (o: {
  livreurId?: string;
  client?: ClientResponse;
  date?: string;
  lignes: Array<{ produit: ProduitResponse; qteLivre: number; qteRetourne?: number }>;
}): LivraisonResponse =>
  ({
    id: `liv-${++seq}`,
    livreur: livreur(o.livreurId ?? 'L1'),
    client: o.client ?? AWA,
    date: o.date ?? '2026-10-12T09:30:00',
    produitsLivraison: o.lignes.map((l) => ({
      produit: l.produit,
      qteLivre: l.qteLivre,
      qteRetourne: l.qteRetourne ?? 0,
    })),
  }) as unknown as LivraisonResponse;

describe('jours', () => {
  it('ajoute des jours en calendrier local', () => {
    expect(ajouterJours('2026-10-31', 1)).toBe('2026-11-01');
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('lit le jour d’une date du back sans décaler', () => {
    expect(jourDe('2026-10-13T00:00:00')).toBe('2026-10-13');
    expect(jourDe(null)).toBeNull();
  });
  it('libellé du bouton : jour abrégé + JJ/MM', () => {
    expect(jourAbrege('2026-10-13')).toBe('mar. 13/10');
    expect(libelleEnregistrerPour('2026-10-12')).toBe('Enregistrer pour le lun. 12/10');
  });
  it('date prévue obligatoire, pas dans le passé, aujourd’hui autorisé', () => {
    expect(erreurDatePrevue(null, '2026-10-12')).toBe('Choisis la date de livraison prévue.');
    expect(erreurDatePrevue('2026-10-11', '2026-10-12')).toMatch(/passé/);
    expect(erreurDatePrevue('2026-10-12', '2026-10-12')).toBeNull();
    expect(erreurDatePrevue('2026-10-13', '2026-10-12')).toBeNull();
  });
});

describe('prevuLivre', () => {
  it('À livrer quand rien n’est livré', () => {
    expect(prevuLivre(10, 0)).toEqual({ prevu: 10, livre: 0, reste: 10, ecart: -10, statut: 'A_LIVRER' });
  });
  it('Partiel quand 0 < Livré < Prévu', () => {
    expect(prevuLivre(10, 4)).toEqual({ prevu: 10, livre: 4, reste: 6, ecart: -6, statut: 'PARTIEL' });
  });
  it('Livré quand Livré ≥ Prévu ; Reste jamais négatif', () => {
    expect(prevuLivre(10, 10).statut).toBe('LIVRE');
    expect(prevuLivre(10, 12)).toEqual({ prevu: 10, livre: 12, reste: 0, ecart: 2, statut: 'LIVRE' });
  });
});

describe('regrouperPrevisions', () => {
  it('somme les prévisions du même client + produit + jour en une ligne', () => {
    const g = regrouperPrevisions([
      prev({ id: 'a', qte: 3 }),
      prev({ id: 'b', qte: 2 }),
      prev({ id: 'c', qte: 5, produit: CROISSANT }),
    ]);
    expect(g).toHaveLength(2);
    const pain = g.find((x) => x.produit.id === 'p1')!;
    expect(pain.prevu).toBe(5);
    expect(pain.ids).toEqual(['a', 'b']);
    expect(pain.cle).toBe(cleGroupe('L1', 'c1', 'p1', '2026-10-12'));
  });

  it('Livré = quantités livrées (pas les retours) de ce livreur à ce client ce jour', () => {
    const g = regrouperPrevisions(
      [prev({ qte: 10 })],
      [
        liv({ lignes: [{ produit: PAIN, qteLivre: 4, qteRetourne: 3 }] }),
        liv({ lignes: [{ produit: PAIN, qteLivre: 2 }] }),
        liv({ client: BEN, lignes: [{ produit: PAIN, qteLivre: 50 }] }),
        liv({ livreurId: 'L2', lignes: [{ produit: PAIN, qteLivre: 50 }] }),
        liv({ date: '2026-10-11T18:00:00', lignes: [{ produit: PAIN, qteLivre: 50 }] }),
      ],
    );
    expect(g[0]).toMatchObject({ prevu: 10, livre: 6, reste: 4, ecart: -4, statut: 'PARTIEL' });
  });

  it('trie par client puis produit et regroupe par client', () => {
    const g = regrouperPrevisions([
      prev({ client: BEN, qte: 1 }),
      prev({ qte: 1, produit: PAIN }),
      prev({ qte: 1, produit: CROISSANT }),
    ]);
    expect(g.map((x) => `${x.client.prenom}/${x.produit.designation}`)).toEqual([
      'Awa/Croissant',
      'Awa/Pain',
      'Ben/Pain',
    ]);
    const blocs = parClient(g);
    expect(blocs.map((b) => [b.client.prenom, b.lignes.length])).toEqual([
      ['Awa', 2],
      ['Ben', 1],
    ]);
  });

  it('sépare les livreurs (blocs apprentis)', () => {
    const g = regrouperPrevisions([
      prev({ livreur: livreur('A2', 'Zoé'), qte: 1 }),
      prev({ livreur: livreur('A1', 'Brice'), qte: 1 }),
      prev({ livreur: livreur('A1', 'Brice'), qte: 2 }),
    ]);
    expect(parLivreur(g).map((b) => [b.livreurNom, b.lignes[0].prevu])).toEqual([
      ['Brice K', 3],
      ['Zoé K', 1],
    ]);
  });
});

describe('échues', () => {
  const aujourdhui = '2026-10-12';
  it('échue = jour passé et Reste > 0', () => {
    expect(estEchue({ jour: '2026-10-11', reste: 2 }, aujourdhui)).toBe(true);
    expect(estEchue({ jour: '2026-10-11', reste: 0 }, aujourdhui)).toBe(false);
    expect(estEchue({ jour: '2026-10-12', reste: 2 }, aujourdhui)).toBe(false);
  });

  it('jours lus : J−1 à J−7', () => {
    const j = joursEchues(aujourdhui);
    expect(j).toHaveLength(7);
    expect(j[0]).toBe('2026-10-11');
    expect(j[6]).toBe('2026-10-05');
  });

  it('« Plus tard » masque le groupe jusqu’au lendemain', () => {
    const groupes = regrouperPrevisions(
      [prev({ qte: 3, jour: '2026-10-10' }), prev({ qte: 3, jour: '2026-10-11', produit: CROISSANT })],
      [],
    );
    expect(echuesATraiter(groupes, {}, aujourdhui)).toHaveLength(2);
    const memo = ajouterPlusTard({ vieux: '2026-10-01' }, [groupes[0].cle], aujourdhui);
    expect(memo).toEqual({ [groupes[0].cle]: aujourdhui });
    expect(echuesATraiter(groupes, memo, aujourdhui).map((g) => g.cle)).toEqual([groupes[1].cle]);
    // Le lendemain, le groupe revient.
    expect(echuesATraiter(groupes, memo, '2026-10-13')).toHaveLength(2);
  });

  it('mémoire stockée : clé par utilisateur, lecture tolérante', () => {
    expect(cleStockagePlusTard('u1')).toBe('GL_PREVISIONS_PLUS_TARD:u1');
    expect(lireMemoirePlusTard('{bad')).toEqual({});
    expect(lireMemoirePlusTard('[1]')).toEqual({});
    expect(lireMemoirePlusTard('{"a":"2026-10-12","b":3}')).toEqual({ a: '2026-10-12' });
  });
});

describe('plans d’écriture', () => {
  const cible = { livreurId: 'L1', clientId: 'c1', produitId: 'p1', jour: '2026-10-13' };

  it('création : ajoute à l’existante au lieu de dupliquer', () => {
    const existantes = [prev({ id: 'x', qte: 4, jour: '2026-10-13' })];
    expect(planCreation(existantes, cible, 3)).toEqual({ type: 'ajout', id: 'x', qteEstimee: 7 });
    expect(planCreation(existantes, { ...cible, produitId: 'p2' }, 3)).toEqual({
      type: 'creation',
      qteEstimee: 3,
    });
    // Autre livreur (apprenti) : pas de fusion.
    expect(planCreation(existantes, { ...cible, livreurId: 'A1' }, 3).type).toBe('creation');
  });

  it('modification : la nouvelle quantité remplace le total', () => {
    expect(planModification({ ids: ['a', 'b', 'c'] }, 9)).toEqual({
      maj: { id: 'a', qteEstimee: 9 },
      suppressions: ['b', 'c'],
    });
  });

  it('report : Reste reporté au jour cible, prévisions échues supprimées', () => {
    const [g] = regrouperPrevisions(
      [prev({ id: 'a', qte: 6, jour: '2026-10-10' }), prev({ id: 'b', qte: 4, jour: '2026-10-10' })],
      [liv({ date: '2026-10-10T10:00:00', lignes: [{ produit: PAIN, qteLivre: 3 }] })],
    );
    expect(g.reste).toBe(7);
    expect(planReport(g, '2026-10-13', [])).toEqual({
      creation: { type: 'creation', qteEstimee: 7, commentaire: 'Reporté du 10/10' },
      cible,
      suppressions: ['a', 'b'],
    });
    expect(planReport(g, '2026-10-13', [prev({ id: 'z', qte: 2, jour: '2026-10-13' })]).creation).toEqual({
      type: 'ajout',
      id: 'z',
      qteEstimee: 9,
      commentaire: 'Reporté du 10/10',
    });
  });

  it('report : marque ajoutée après « · » au commentaire existant ; idempotent si déjà marqué', () => {
    const [g] = regrouperPrevisions([prev({ id: 'a', qte: 4, jour: '2026-10-10', commentaire: 'matin' })], []);
    expect(planReport(g, '2026-10-13', []).creation).toEqual({
      type: 'creation',
      qteEstimee: 4,
      commentaire: 'matin · Reporté du 10/10',
    });
    expect(
      planReport(g, '2026-10-13', [prev({ id: 'z', qte: 2, jour: '2026-10-13', commentaire: 'soir' })]).creation,
    ).toEqual({ type: 'ajout', id: 'z', qteEstimee: 6, commentaire: 'soir · Reporté du 10/10' });
    const deja = planReport(g, '2026-10-13', [prev({ id: 'z', qte: 6, jour: '2026-10-13', commentaire: 'soir · Reporté du 10/10' })]);
    expect(deja).toEqual({ creation: { type: 'deja' }, cible, suppressions: ['a'] });
    expect(marqueReport('2026-10-10')).toBe('Reporté du 10/10');
  });

  it('commentaires : ajoutés, jamais écrasés', () => {
    expect(fusionnerCommentaires('matin', 'urgent')).toBe('matin · urgent');
    expect(fusionnerCommentaires('matin · urgent', 'urgent')).toBe('matin · urgent');
    expect(fusionnerCommentaires(null, ' urgent ')).toBe('urgent');
    expect(fusionnerCommentaires('', '')).toBeNull();
    expect(planCreation([prev({ id: 'x', qte: 1, jour: '2026-10-13', commentaire: 'matin' })], cible, 2)).toEqual({
      type: 'ajout',
      id: 'x',
      qteEstimee: 3,
    });
    expect(planModification({ ids: ['a', 'b'], commentaire: 'note' }, 5).maj).toEqual({ id: 'a', qteEstimee: 5, commentaire: 'note' });
  });
});

describe('préremplissages', () => {
  it('livraison : prévisions du jour de ce client, quantité = Reste, rien si Reste = 0', () => {
    const previsions = [
      prev({ qte: 10 }),
      prev({ qte: 5, produit: CROISSANT }),
      prev({ qte: 7, client: BEN }),
      prev({ qte: 7, jour: '2026-10-13' }),
      prev({ qte: 7, livreur: livreur('A1') }),
    ];
    const livraisons = [liv({ lignes: [{ produit: PAIN, qteLivre: 4 }, { produit: CROISSANT, qteLivre: 5 }] })];
    expect(
      lignesDepuisPrevisions(previsions, livraisons, { livreurId: 'L1', clientId: 'c1', jour: '2026-10-12' }),
    ).toEqual([{ produitId: 'p1', designation: 'Pain', qte: 6 }]);
  });

  it('commande : cumul brut pour les produits proposés, les autres à part', () => {
    const r = prefillCommande(
      [
        { produit: PAIN, qteCumulee: 12 },
        { produit: CROISSANT, qteCumulee: 4 },
        { produit: produit('p3', 'Baguette'), qteCumulee: 0 },
      ],
      [{ produit: PAIN }] as never,
    );
    expect(r).toEqual({
      quantites: { p1: '12' },
      nonProposes: [{ produitId: 'p2', designation: 'Croissant', qte: 4 }],
    });
  });
});

describe('formatEcart', () => {
  it('signe l’écart', () => {
    expect([formatEcart(2), formatEcart(-4), formatEcart(0)]).toEqual(['+2', '−4', '0']);
  });
});

describe('appliquerPrevisions', () => {
  const prevues = [
    { produitId: 'p1', designation: 'Pain', qte: 6 },
    { produitId: 'p2', designation: 'Croissant', qte: 2 },
  ];
  it('formulaire vide : lignes préremplies au prix habituel', () => {
    expect(appliquerPrevisions([], prevues, 150)).toEqual([
      { produitId: 'p1', designation: 'Pain', prix: 150, qte: 6 },
      { produitId: 'p2', designation: 'Croissant', prix: 150, qte: 2 },
    ]);
  });
  it('reprise : quantité = Reste, prix saisi conservé, autres lignes intactes', () => {
    const lignes = [
      { produitId: 'p1', designation: 'Pain', prix: 200, qte: 1, memoriserPrix: true },
      { produitId: 'p9', designation: 'Gâteau', prix: 500, qte: 3 },
    ];
    expect(appliquerPrevisions(lignes, prevues, 150)).toEqual([
      { produitId: 'p1', designation: 'Pain', prix: 200, qte: 6, memoriserPrix: true },
      { produitId: 'p9', designation: 'Gâteau', prix: 500, qte: 3 },
      { produitId: 'p2', designation: 'Croissant', prix: 150, qte: 2 },
    ]);
  });
});
