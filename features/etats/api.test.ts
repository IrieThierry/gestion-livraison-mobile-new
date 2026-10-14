import { apiClient } from '../../lib/api-client';
import { etatsApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const P = { debut: '2026-10-01', fin: '2026-10-31' };
const avecPeriode = { params: { debut: '2026-10-01', fin: '2026-10-31' } };

describe('etatsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    get.mockResolvedValue({ data: [] });
  });

  it('livraisons : livreur ou équipe, avec la période', async () => {
    await etatsApi.livraisons({ mode: 'livreur', livreurId: 'l1' }, P);
    await etatsApi.livraisons({ mode: 'equipe', parentId: 'p1' }, P);
    expect(get).toHaveBeenNthCalledWith(1, '/livraison/livraison-livreur/l1', avecPeriode);
    expect(get).toHaveBeenNthCalledWith(2, '/livraison/parent/p1', avecPeriode);
  });

  it('encaissements et encours : sans période (filtrés côté client / solde actuel)', async () => {
    await etatsApi.encaissements({ mode: 'livreur', livreurId: 'l1' });
    await etatsApi.encaissements({ mode: 'equipe', parentId: 'p1' });
    await etatsApi.encours({ mode: 'livreur', livreurId: 'l1' });
    await etatsApi.encours({ mode: 'equipe', parentId: 'p1' });
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      '/encaissement/livraison/livreur/l1',
      '/encaissement/livraison/parent/p1',
      '/client/encours/livreur/l1',
      '/client/encours/parent/p1',
    ]);
    expect(get.mock.calls.every((c) => c[1] === undefined)).toBe(true);
  });

  it('stock et mouvements', async () => {
    await etatsApi.stockLivreur('l1');
    await etatsApi.stockEquipe();
    await etatsApi.mouvements('l1', P);
    expect(get).toHaveBeenNthCalledWith(1, '/stock-livreur/l1/actuel', undefined);
    expect(get).toHaveBeenNthCalledWith(2, '/stock-livreur/equipe', undefined);
    expect(get).toHaveBeenNthCalledWith(3, '/stock-livreur/l1/historique', avecPeriode);
  });

  it('fournisseurs : partenaires, toutes les commandes, versements de la période', async () => {
    await etatsApi.partenaires();
    await etatsApi.commandes();
    await etatsApi.versements('l1', P);
    expect(get).toHaveBeenNthCalledWith(1, '/livreur/me/fournisseurs', undefined);
    expect(get).toHaveBeenNthCalledWith(2, '/commande/me', undefined);
    expect(get).toHaveBeenNthCalledWith(3, '/versement/livreur/l1', avecPeriode);
  });

  it('dépenses : route de l’appelant, période en startDate / endDate', async () => {
    await etatsApi.depenses(P);
    expect(get).toHaveBeenCalledWith('/depense', { params: { startDate: '2026-10-01', endDate: '2026-10-31' } });
  });

  it('dépenses (S5) : équipe → equipe=true, apprenti → livreurId', async () => {
    await etatsApi.depenses(P, { equipe: true });
    expect(get).toHaveBeenLastCalledWith('/depense', {
      params: { startDate: '2026-10-01', endDate: '2026-10-31', equipe: 'true' },
    });
    await etatsApi.depenses(P, { livreurId: 'a1' });
    expect(get).toHaveBeenLastCalledWith('/depense', {
      params: { startDate: '2026-10-01', endDate: '2026-10-31', livreurId: 'a1' },
    });
  });
});
