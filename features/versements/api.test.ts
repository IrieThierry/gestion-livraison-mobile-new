import { apiClient } from '../../lib/api-client';
import { versementsApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: {} });
  post.mockResolvedValue({ data: { id: 'v-1' } });
});

describe('contrat API versement par commandes', () => {
  it('situation : commandeIds séparés par des virgules, jamais en tableau', async () => {
    await versementsApi.situation({ livreurId: 'l-1', fournisseurId: 'f-1', commandeIds: ['a', 'b'] });
    expect(get).toHaveBeenCalledWith('/versement/situation', {
      params: { livreurId: 'l-1', fournisseurId: 'f-1', commandeIds: 'a,b' },
    });
  });

  it('situation : paramètre absent quand la sélection est vide (versement libre)', async () => {
    await versementsApi.situation({ livreurId: 'l-1', fournisseurId: 'f-1', commandeIds: [] });
    const params = get.mock.calls[0][1].params;
    expect(params).toEqual({ livreurId: 'l-1', fournisseurId: 'f-1' });
    expect(params).not.toHaveProperty('commandeIds');
  });

  it("enregistrement : corps sans dates de plage ni drapeau libre", async () => {
    await versementsApi.enregistrer({
      livreurId: 'l-1',
      fournisseurId: 'f-1',
      commandeIds: ['a'],
      dateVersement: '2026-10-02',
      montantVerse: 5000,
    });
    const corps = post.mock.calls[0][1];
    expect(post.mock.calls[0][0]).toBe('/versement');
    expect(corps).toEqual({
      livreurId: 'l-1',
      fournisseurId: 'f-1',
      commandeIds: ['a'],
      dateVersement: '2026-10-02',
      montantVerse: 5000,
    });
    expect(corps).not.toHaveProperty('dateDebut');
    expect(corps).not.toHaveProperty('libre');
  });
});
