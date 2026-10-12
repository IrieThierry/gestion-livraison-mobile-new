import { apiClient } from '../../lib/api-client';
import { livraisonsApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const get = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
});

describe('contrat API livraisons du livreur', () => {
  it('sans période : pas de paramètres', async () => {
    await livraisonsApi.byLivreur('liv-1');
    expect(get).toHaveBeenCalledWith('/livraison/livraison-livreur/liv-1', undefined);
  });

  it('avec période : debut / fin en jours entiers', async () => {
    await livraisonsApi.byLivreur('liv-1', { debut: '2026-10-01', fin: '2026-10-12' });
    expect(get).toHaveBeenCalledWith('/livraison/livraison-livreur/liv-1', {
      params: { debut: '2026-10-01', fin: '2026-10-12' },
    });
  });
});
