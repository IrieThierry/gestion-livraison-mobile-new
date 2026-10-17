import { apiClient } from '../../lib/api-client';
import { filtresRecapitulatif, recapitulatifApi, totauxRecapitulatif } from './recapitulatif';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: { produits: [], enAttente: [], refusees: [] } });
});

describe('Récapitulatif des remises : API', () => {
  it('envoie la période et seulement les filtres choisis', async () => {
    await recapitulatifApi.lire({ debut: '2026-10-01', fin: '2026-10-17' });
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/recapitulatif', {
      params: { debut: '2026-10-01', fin: '2026-10-17' },
    });
    await recapitulatifApi.lire({ debut: '2026-10-17', fin: '2026-10-17', livreurId: 'l1', commisId: 'c1', clientId: 'k1' });
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/recapitulatif', {
      params: { debut: '2026-10-17', fin: '2026-10-17', livreurId: 'l1', commisId: 'c1', clientId: 'k1' },
    });
  });
});

describe('Récapitulatif des remises : règles', () => {
  it('filtres : bornes de la période, filtres vides ignorés', () => {
    expect(filtresRecapitulatif({ debut: '2026-10-01', fin: '2026-10-17' }, { livreurId: '', commisId: null, clientId: 'k1' })).toEqual({
      debut: '2026-10-01',
      fin: '2026-10-17',
      clientId: 'k1',
    });
  });

  it('totaux par produit : remis aux livreurs et sortis aux clients', () => {
    const produits = [
      { produitFournisseurId: 'p1', designation: 'Baguette', photoUrl: null, totalConfirme: 30, totalClients: 5, parLivreur: [], parClient: [] },
      { produitFournisseurId: 'p2', designation: 'Pain', photoUrl: null, totalConfirme: 12, totalClients: 0, parLivreur: [], parClient: [] },
    ];
    expect(totauxRecapitulatif(produits)).toEqual({ remis: 42, sortis: 5 });
    expect(totauxRecapitulatif([])).toEqual({ remis: 0, sortis: 0 });
  });
});
