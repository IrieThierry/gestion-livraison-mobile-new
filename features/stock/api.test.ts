import { apiClient } from '../../lib/api-client';
import { stockApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

describe('stockApi.historique', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lit le journal du livreur avec les filtres en paramètres', async () => {
    const mouvements = [{ type: 'RECEPTION', quantite: 12 }];
    get.mockResolvedValue({ data: mouvements });

    const res = await stockApi.historique('liv-1', {
      debut: '2026-10-01',
      fin: '2026-10-08',
      produitId: 'p-1',
    });

    expect(res).toBe(mouvements);
    expect(get).toHaveBeenCalledWith('/stock-livreur/liv-1/historique', {
      params: { debut: '2026-10-01', fin: '2026-10-08', produitId: 'p-1' },
    });
  });

  it('sans filtre : aucun paramètre', async () => {
    get.mockResolvedValue({ data: [] });
    await stockApi.historique('liv-1');
    expect(get).toHaveBeenCalledWith('/stock-livreur/liv-1/historique', { params: {} });
  });

  it("n'expose plus l'achat manuel", () => {
    expect((stockApi as Record<string, unknown>).enregistrerAchat).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });
});
