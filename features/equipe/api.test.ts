import { apiClient } from '../../lib/api-client';
import { equipeApi } from './api';
import { prixApi } from '../prix/api';
import { produitsApi } from '../produits/api';
import { stockApi } from '../stock/api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: { reaffectes: 2, clientIds: ['c1', 'c2'] } });
});

describe('routes des ajustements (P2, P3, P8)', () => {
  it('réaffecter : POST /equipe/clients/reaffecter avec la demande', async () => {
    const r = await equipeApi.reaffecter({ clientIds: ['c1', 'c2'], livreurId: 'a1' });
    expect(post).toHaveBeenCalledWith('/equipe/clients/reaffecter', { clientIds: ['c1', 'c2'], livreurId: 'a1' });
    expect(r.reaffectes).toBe(2);
  });

  it('historique : GET /equipe/reaffectations, bornes seulement si présentes', async () => {
    await equipeApi.reaffectations({ debut: '2026-10-01', fin: '2026-10-13' });
    expect(get).toHaveBeenCalledWith('/equipe/reaffectations', { params: { debut: '2026-10-01', fin: '2026-10-13' } });
    await equipeApi.reaffectations({});
    expect(get).toHaveBeenLastCalledWith('/equipe/reaffectations', { params: {} });
  });

  it('prix d’achat : GET /prix-achat/me', async () => {
    await prixApi.mesPrixAchat();
    expect(get).toHaveBeenCalledWith('/prix-achat/me');
  });

  it('listes de produits triées par désignation (accents et majuscules ignorés)', async () => {
    get.mockResolvedValueOnce({ data: [{ id: '1', designation: 'pain' }, { id: '2', designation: 'Éclair' }, { id: '3', designation: 'beurre' }] });
    expect((await produitsApi.list()).map((p) => p.id)).toEqual(['3', '2', '1']);
    get.mockResolvedValueOnce({ data: [{ produit: { designation: 'Sucre' } }, { produit: { designation: 'farine' } }] });
    expect((await prixApi.mesPrix()).map((p) => p.produit.designation)).toEqual(['farine', 'Sucre']);
    get.mockResolvedValueOnce({ data: [{ produit: { designation: 'Sucre' } }, { produit: { designation: 'Ail' } }] });
    expect((await stockApi.courant()).map((s) => s.produit.designation)).toEqual(['Ail', 'Sucre']);
  });
});
