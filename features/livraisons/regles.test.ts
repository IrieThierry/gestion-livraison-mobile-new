import {
  bilanLivraisonEtRetours,
  buildCreerLivraisonPayload,
  enregistrerLivraisonEtRetours,
  erreurLignesLivraison,
  etatApresEchecPartiel,
  MESSAGE_DESTINATION_RETOUR,
  montantLigneEstime,
  regrouperRetours,
  retoursSansDestination,
  totalLivraisonEstime,
  type LigneSaisie,
  type RetoursParLivraison,
} from './regles';
import type { LivraisonResponse } from '../../types/api';

const l = (over: Partial<LigneSaisie>): LigneSaisie => ({
  produitId: 'p-1',
  designation: 'Pain',
  prix: 100,
  qte: 2,
  ...over,
});

describe('estimations', () => {
  it('ligne = (prix + remise) × quantité', () => {
    expect(montantLigneEstime(100, 12.5, 4)).toBe(450);
    expect(montantLigneEstime(100, undefined, 3)).toBe(300);
  });

  it('total : remise ignorée pour un client sans remise, lignes à 0 exclues', () => {
    const lignes = [l({ remise: 10 }), l({ produitId: 'p-2', qte: 0, prix: 500 })];
    expect(totalLivraisonEstime(lignes, true)).toBe(220);
    expect(totalLivraisonEstime(lignes, false)).toBe(200);
  });
});

describe('erreurLignesLivraison', () => {
  it('prix > 0 obligatoire', () => {
    expect(erreurLignesLivraison([l({ prix: 0 })], false)).toMatch(/prix/i);
    expect(erreurLignesLivraison([l({})], false)).toBeNull();
  });

  it('remise invalide bloquante seulement pour un client avec remise', () => {
    expect(erreurLignesLivraison([l({ remiseInvalide: true })], true)).toMatch(/remise/i);
    expect(erreurLignesLivraison([l({ remiseInvalide: true })], false)).toBeNull();
  });
});

describe('buildCreerLivraisonPayload', () => {
  it('client avec remise : remise saisie envoyée (0 compris), memoriserPrixClient explicite', () => {
    const p = buildCreerLivraisonPayload({
      livreurId: 'l-1',
      remiseFixable: true,
      client: { id: 'c-1', avecOuSansRemise: true },
      lignes: [
        l({ remise: 12.5, remiseSaisie: true, memoriserPrix: true }),
        l({ produitId: 'p-2', remise: 0, remiseSaisie: true }),
      ],
    });
    expect(p).toEqual({
      livreurId: 'l-1',
      clientId: 'c-1',
      avecRemise: true,
      produitsLivraison: [
        {
          produitId: 'p-1',
          qteLivree: 2,
          qteRetournee: 0,
          qteRetourneeEnStock: 0,
          prixDeVente: 100,
          memoriserPrixClient: true,
          remiseUnitaire: 12.5,
        },
        {
          produitId: 'p-2',
          qteLivree: 2,
          qteRetournee: 0,
          qteRetourneeEnStock: 0,
          prixDeVente: 100,
          memoriserPrixClient: false,
          remiseUnitaire: 0,
        },
      ],
    });
  });

  it('remise pré-remplie non modifiée : pas de remiseUnitaire (le back applique la convenue)', () => {
    const p = buildCreerLivraisonPayload({
      livreurId: 'l-1',
      remiseFixable: true,
      client: { id: 'c-1', avecOuSansRemise: true },
      lignes: [l({ remise: 12.5 }), l({ produitId: 'p-2', remise: 7, remiseSaisie: false })],
    });
    for (const x of p.produitsLivraison) expect(x).not.toHaveProperty('remiseUnitaire');
  });

  it('remise inconnue (non chargée) : pas de remiseUnitaire, le back applique la convenue', () => {
    const p = buildCreerLivraisonPayload({
      livreurId: 'l-1',
      remiseFixable: true,
      client: { id: 'c-1', avecOuSansRemise: true },
      lignes: [l({})],
    });
    expect(p.produitsLivraison[0]).not.toHaveProperty('remiseUnitaire');
    expect(p.produitsLivraison[0]?.memoriserPrixClient).toBe(false);
  });

  it('client sans remise : jamais de remiseUnitaire, avecRemise false', () => {
    const p = buildCreerLivraisonPayload({
      livreurId: 'l-1',
      remiseFixable: true,
      client: { id: 'c-1', avecOuSansRemise: false },
      lignes: [l({ remise: 50, remiseSaisie: true })],
    });
    expect(p.avecRemise).toBe(false);
    expect(p.produitsLivraison[0]).not.toHaveProperty('remiseUnitaire');
  });

  it('apprenti (remiseFixable false) : remise saisie jamais envoyée', () => {
    const p = buildCreerLivraisonPayload({
      livreurId: 'l-1',
      remiseFixable: false,
      client: { id: 'c-1', avecOuSansRemise: true },
      lignes: [l({ remise: 12.5, remiseSaisie: true }), l({ produitId: 'p-2', remise: 0, remiseSaisie: true })],
    });
    expect(p.avecRemise).toBe(true);
    for (const x of p.produitsLivraison) expect(x).not.toHaveProperty('remiseUnitaire');
  });

  it('lignes à quantité 0 non envoyées', () => {
    const p = buildCreerLivraisonPayload({
      livreurId: 'l-1',
      remiseFixable: true,
      client: { id: 'c-1', avecOuSansRemise: false },
      lignes: [l({ qte: 0 }), l({ produitId: 'p-2' })],
    });
    expect(p.produitsLivraison.map((x) => x.produitId)).toEqual(['p-2']);
  });
});

const liv = (id: string, plIds: string[]) =>
  ({ id, produitsLivraison: plIds.map((pl) => ({ id: pl })) }) as unknown as LivraisonResponse;

describe('regrouperRetours', () => {
  it('un groupe par livraison, retours > 0 seulement, destination conservée', () => {
    const r = regrouperRetours([liv('a', ['a1', 'a2']), liv('b', ['b1']), liv('c', ['c1'])], {
      a1: { qte: 2, enStock: true },
      a2: { qte: 0, enStock: null },
      b1: { qte: 1, enStock: false },
    });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.valeur.map((g) => g.livraison.id)).toEqual(['a', 'b']);
    expect(r.valeur[0]?.lignes).toEqual([
      { produitLivraisonId: 'a1', quantite: 2, remettreEnStock: true },
    ]);
    expect(r.valeur[1]?.lignes).toEqual([
      { produitLivraisonId: 'b1', quantite: 1, remettreEnStock: false },
    ]);
  });

  it('refuse un retour > 0 sans destination choisie (pas de défaut)', () => {
    const r = regrouperRetours([liv('a', ['a1', 'a2'])], {
      a1: { qte: 2, enStock: true },
      a2: { qte: 1, enStock: null },
    });
    expect(r).toEqual({ ok: false, erreur: MESSAGE_DESTINATION_RETOUR });
    expect(MESSAGE_DESTINATION_RETOUR).toBe(
      'Choisis « Remettre en stock » ou « Perdu » pour chaque retour.',
    );
  });

  it('retoursSansDestination compte les retours > 0 sans choix', () => {
    expect(
      retoursSansDestination({
        a: { qte: 1, enStock: null },
        b: { qte: 0, enStock: null },
        c: { qte: 2, enStock: false },
      }),
    ).toBe(1);
  });
});

describe('etatApresEchecPartiel', () => {
  const retours: RetoursParLivraison[] = [
    { livraison: liv('a', ['a1']), lignes: [{ produitLivraisonId: 'a1', quantite: 1, remettreEnStock: true }] },
    { livraison: liv('b', ['b1']), lignes: [{ produitLivraisonId: 'b1', quantite: 2, remettreEnStock: false }] },
  ];
  const saisie = {
    a1: { qte: 1, enStock: true },
    b1: { qte: 2, enStock: false },
    z9: { qte: 0, enStock: null },
  };

  it('livraison créée : lignes vidées, seuls les retours échoués restent', () => {
    const etat = etatApresEchecPartiel({
      res: {
        livraisonCreee: true,
        erreurLivraison: null,
        retoursEnregistres: ['a'],
        retoursEchoues: [{ livraisonId: 'b', message: 'x' }],
      },
      retours,
      lignes: [l({})],
      saisie,
    });
    expect(etat.lignes).toEqual([]);
    expect(etat.saisie).toEqual({ b1: { qte: 2, enStock: false }, z9: { qte: 0, enStock: null } });
  });

  it('pas de livraison à créer : lignes conservées', () => {
    const lignes = [l({ qte: 0 })];
    const etat = etatApresEchecPartiel({
      res: {
        livraisonCreee: false,
        erreurLivraison: null,
        retoursEnregistres: [],
        retoursEchoues: [{ livraisonId: 'a', message: 'x' }, { livraisonId: 'b', message: 'y' }],
      },
      retours,
      lignes,
      saisie,
    });
    expect(etat.lignes).toBe(lignes);
    expect(etat.saisie).toEqual(saisie);
  });
});

describe('enregistrerLivraisonEtRetours', () => {
  const retours: RetoursParLivraison[] = [
    { livraison: liv('a', ['a1']), lignes: [] },
    { livraison: liv('b', ['b1']), lignes: [] },
    { livraison: liv('c', ['c1']), lignes: [] },
  ];
  const messageErreur = (e: unknown) => (e as Error).message;

  it('échec de création : aucun retour tenté', async () => {
    const enregistrerRetour = jest.fn();
    const res = await enregistrerLivraisonEtRetours({
      creer: () => Promise.reject(new Error('Stock insuffisant pour Pain')),
      retours,
      enregistrerRetour,
      messageErreur,
    });
    expect(res.livraisonCreee).toBe(false);
    expect(res.erreurLivraison).toBe('Stock insuffisant pour Pain');
    expect(enregistrerRetour).not.toHaveBeenCalled();
    const bilan = bilanLivraisonEtRetours(res, { livraison: true, nbRetours: 3 });
    expect(bilan.ok).toBe(false);
    expect(bilan.message).toMatch(/Aucun retour/);
  });

  it('échec partiel : continue après un retour en échec et rapporte fait / à refaire', async () => {
    const enregistrerRetour = jest.fn((r: RetoursParLivraison) =>
      r.livraison.id === 'b' ? Promise.reject(new Error('Conflit')) : Promise.resolve({}),
    );
    const creer = jest.fn(() => Promise.resolve({}));
    const res = await enregistrerLivraisonEtRetours({ creer, retours, enregistrerRetour, messageErreur });
    expect(creer).toHaveBeenCalledTimes(1);
    expect(enregistrerRetour).toHaveBeenCalledTimes(3);
    expect(res).toEqual({
      livraisonCreee: true,
      erreurLivraison: null,
      retoursEnregistres: ['a', 'c'],
      retoursEchoues: [{ livraisonId: 'b', message: 'Conflit' }],
    });
    const bilan = bilanLivraisonEtRetours(res, { livraison: true, nbRetours: 3 });
    expect(bilan.ok).toBe(false);
    expect(bilan.message).toContain('Livraison du jour créée.');
    expect(bilan.message).toContain('2 retour(s) enregistré(s).');
    expect(bilan.message).toContain('1 retour(s) non enregistré(s), à refaire');
    expect(bilan.message).toContain('Conflit');
  });

  it('retours seuls, tout réussi', async () => {
    const res = await enregistrerLivraisonEtRetours({
      creer: null,
      retours: retours.slice(0, 1),
      enregistrerRetour: () => Promise.resolve({}),
      messageErreur,
    });
    expect(res.livraisonCreee).toBe(false);
    expect(bilanLivraisonEtRetours(res, { livraison: false, nbRetours: 1 })).toEqual({
      ok: true,
      titre: 'Retour(s) enregistré(s)',
      message: '',
    });
  });

  it('livraison seule, réussie', async () => {
    const res = await enregistrerLivraisonEtRetours({
      creer: () => Promise.resolve({}),
      retours: [],
      enregistrerRetour: jest.fn(),
      messageErreur,
    });
    expect(bilanLivraisonEtRetours(res, { livraison: true, nbRetours: 0 }).titre).toBe(
      'Livraison enregistrée',
    );
  });
});
