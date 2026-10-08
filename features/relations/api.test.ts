import { apiClient } from '../../lib/api-client';
import { relationsApi } from './api';
import { lookupsApi } from '../lookups/api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

describe('relationsApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fournisseurs : GET /livreur/me/fournisseurs', async () => {
    get.mockResolvedValue({ data: [{ id: 'f-1' }] });
    await expect(relationsApi.fournisseurs()).resolves.toEqual([{ id: 'f-1' }]);
    expect(get).toHaveBeenCalledWith('/livreur/me/fournisseurs');
  });

  it('inviter : POST /livreur/me/relations-fournisseurs avec {fournisseurId}', async () => {
    post.mockResolvedValue({ data: { id: 'r-1', statut: 'EN_ATTENTE' } });
    await relationsApi.inviter('f-1');
    expect(post).toHaveBeenCalledWith('/livreur/me/relations-fournisseurs', {
      fournisseurId: 'f-1',
    });
  });

  it('annuler : POST /livreur/me/relations-fournisseurs/{id}/annuler sans corps', async () => {
    post.mockResolvedValue({ data: { id: 'r-1', statut: 'ANNULEE' } });
    await relationsApi.annuler('r-1');
    expect(post).toHaveBeenCalledWith('/livreur/me/relations-fournisseurs/r-1/annuler');
  });
});

describe('lookupsApi fournisseurs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('partenaires : GET /fournisseur?partenaires=true', async () => {
    get.mockResolvedValue({ data: [] });
    await lookupsApi.fournisseursPartenaires();
    expect(get).toHaveBeenCalledWith('/fournisseur', { params: { partenaires: true } });
  });

  it('fournisseurs (versement) : GET /fournisseur sans paramètre', async () => {
    get.mockResolvedValue({ data: [] });
    await lookupsApi.fournisseurs();
    expect(get).toHaveBeenCalledWith('/fournisseur');
  });
});
