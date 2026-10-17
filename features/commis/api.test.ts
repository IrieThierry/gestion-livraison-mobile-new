import { apiClient } from '../../lib/api-client';
import { commisApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: {} });
});

const LIGNES = [{ produitFournisseurId: 'pf1', quantite: 6 }];

describe('Espace commis : API (routes /commis/me du back)', () => {
  it('commandes (filtre livreur facultatif), livreurs, catalogue, remises d’une commande', async () => {
    await commisApi.commandes();
    expect(get).toHaveBeenLastCalledWith('/commis/me/commandes', { params: {} });
    await commisApi.commandes('l1');
    expect(get).toHaveBeenLastCalledWith('/commis/me/commandes', { params: { livreurId: 'l1' } });
    await commisApi.livreurs();
    expect(get).toHaveBeenLastCalledWith('/commis/me/livreurs');
    await commisApi.catalogue();
    expect(get).toHaveBeenLastCalledWith('/commis/me/catalogue');
    await commisApi.remisesCommande('c1');
    expect(get).toHaveBeenLastCalledWith('/commis/me/commandes/c1/remises');
  });

  it('remise sur une commande, remise sans commande, annulation, commande terminée', async () => {
    await commisApi.remettre('c1', LIGNES);
    expect(post).toHaveBeenLastCalledWith('/commis/me/commandes/c1/remises', { lignes: LIGNES });
    await commisApi.remettreSansCommande('l1', LIGNES);
    expect(post).toHaveBeenLastCalledWith('/commis/me/remises', { livreurId: 'l1', lignes: LIGNES });
    await commisApi.annulerRemise('r1');
    expect(post).toHaveBeenLastCalledWith('/commis/me/remises/r1/annuler');
    await commisApi.terminer('c1');
    expect(post).toHaveBeenLastCalledWith('/commis/me/commandes/c1/terminer');
  });

  it('clients, sorties du jour, sortie, annulation de sortie, récapitulatif', async () => {
    await commisApi.clients();
    expect(get).toHaveBeenLastCalledWith('/commis/me/clients');
    await commisApi.sorties('2026-10-17');
    expect(get).toHaveBeenLastCalledWith('/commis/me/sorties', { params: { date: '2026-10-17' } });
    await commisApi.sortir('k1', LIGNES);
    expect(post).toHaveBeenLastCalledWith('/commis/me/sorties', { clientId: 'k1', lignes: LIGNES });
    await commisApi.annulerSortie('s1');
    expect(post).toHaveBeenLastCalledWith('/commis/me/sorties/s1/annuler');
    get.mockResolvedValueOnce({ data: { produits: [], enAttente: [], refusees: [] } });
    await expect(commisApi.recapitulatif('2026-10-16')).resolves.toEqual({ produits: [], enAttente: [], refusees: [] });
    expect(get).toHaveBeenLastCalledWith('/commis/me/recapitulatif', { params: { date: '2026-10-16' } });
  });
});
