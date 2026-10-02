import { apiClient } from '../../lib/api-client';
import { commandesApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: { id: 'c1' } });
});

describe('contrat API commandes', () => {
  it('liste mes commandes', async () => {
    await commandesApi.mes();
    expect(get).toHaveBeenCalledWith('/commande/me');
  });

  it('liste les commandes à régler chez un fournisseur', async () => {
    await commandesApi.aRegler('f-1');
    expect(get).toHaveBeenCalledWith('/commande/a-regler', { params: { fournisseurId: 'f-1' } });
  });

  it("lit le catalogue d'un fournisseur", async () => {
    await commandesApi.catalogue('f-1');
    expect(get).toHaveBeenCalledWith('/produit-fournisseur', { params: { fournisseurId: 'f-1' } });
  });

  it('crée une commande avec le corps attendu', async () => {
    const payload = { fournisseurId: 'f-1', produitsCommandes: [{ produitId: 'p1', qteCommandee: 3 }] };
    await commandesApi.creer(payload);
    expect(post).toHaveBeenCalledWith('/commande', payload);
  });

  it('annule une commande', async () => {
    await commandesApi.annuler('c-9');
    expect(post).toHaveBeenCalledWith('/commande/c-9/annuler');
  });
});
