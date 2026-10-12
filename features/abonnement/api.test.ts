import { apiClient } from '../../lib/api-client';
import { abonnementApi } from './api';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;

describe('abonnementApi.monAbonnement', () => {
  beforeEach(() => get.mockReset());

  it('GET /abonnement/me renvoie l’abonnement effectif', async () => {
    const abo = { statut: 'ESSAI', formule: 'LIVREUR', debut: '2026-10-12', finEssai: null, finPeriode: null, herite: false };
    get.mockResolvedValue({ status: 200, data: abo });
    await expect(abonnementApi.monAbonnement()).resolves.toEqual(abo);
    expect(get).toHaveBeenCalledWith('/abonnement/me');
  });

  it('204 (admin, sans abonnement) : null', async () => {
    get.mockResolvedValue({ status: 204, data: '' });
    await expect(abonnementApi.monAbonnement()).resolves.toBeNull();
  });
});
