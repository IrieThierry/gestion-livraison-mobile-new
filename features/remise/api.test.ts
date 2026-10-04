import { apiClient } from '../../lib/api-client';
import { remiseApi } from './api';
import { parseRemiseUnitaire } from './regles';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;
const del = apiClient.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [{ id: 'r-1', produit: { id: 'p-1' }, remiseUnitaire: 12.5 }] });
  put.mockResolvedValue({ data: { id: 'r-1', remiseUnitaire: 12.5 } });
  del.mockResolvedValue({ data: undefined });
});

describe('contrat API remise-client', () => {
  it('lecture : GET /remise-client/{clientId}', async () => {
    const r = await remiseApi.parClient('c-1');
    expect(get).toHaveBeenCalledWith('/remise-client/c-1');
    expect(r[0].remiseUnitaire).toBe(12.5);
  });

  it('enregistrement : PUT /remise-client avec {clientId, produitId, remiseUnitaire}', async () => {
    await remiseApi.enregistrer({ clientId: 'c-1', produitId: 'p-1', remiseUnitaire: 12.5 });
    expect(put).toHaveBeenCalledWith('/remise-client', {
      clientId: 'c-1',
      produitId: 'p-1',
      remiseUnitaire: 12.5,
    });
  });

  it('suppression : DELETE /remise-client/{clientId}/{produitId}', async () => {
    await remiseApi.supprimer('c-1', 'p-1');
    expect(del).toHaveBeenCalledWith('/remise-client/c-1/p-1');
  });
});

describe('parseRemiseUnitaire', () => {
  it.each([
    ['12', 12],
    ['12,5', 12.5],
    ['12.75', 12.75],
    ['0', 0],
    ['999999999999.99', 999999999999.99],
  ])('accepte %s', (brut, attendu) => {
    expect(parseRemiseUnitaire(brut)).toEqual({ ok: true, valeur: attendu });
  });

  it.each(['', '  ', '-1', '1.234', 'abc', '1,2,3', '1000000000000'])('refuse %p', (brut) => {
    expect(parseRemiseUnitaire(brut).ok).toBe(false);
  });
});
