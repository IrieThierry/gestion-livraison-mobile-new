import { apiClient } from '../../lib/api-client';
import { encaissementsApi } from './api';
import { clientsApi } from '../clients/api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('contrat API encaissement', () => {
  it('livraisons à encaisser : GET /encaissement/livraison/a-encaisser avec livreurId et clientId', async () => {
    get.mockResolvedValue({
      data: {
        solde: 2000,
        avance: 0,
        livraisons: [{ id: 'L2', reference: 'LIV12', resteDu: 500, statutEncaissement: 'ENCAISSEE' }],
      },
    });
    const r = await encaissementsApi.aEncaisser('l-1', 'c-1');
    expect(get).toHaveBeenCalledWith('/encaissement/livraison/a-encaisser', {
      params: { livreurId: 'l-1', clientId: 'c-1' },
    });
    expect(r.solde).toBe(2000);
    expect(r.livraisons[0].resteDu).toBe(500);
  });

  it('aperçu : POST /encaissement/livraison/apercu avec livraisonIds, sans écriture côté client', async () => {
    post.mockResolvedValue({
      data: {
        duChoisi: 1500,
        ecart: 500,
        soldeApres: 0,
        repartition: [{ livraisonId: 'L3', reference: 'LIV13', part: 1500, resteDuApres: 0 }],
        surplusImpute: [{ livraisonId: 'L2', reference: 'LIV12', part: 500 }],
      },
    });
    const payload = {
      livreurId: 'l-1',
      clientId: 'c-1',
      livraisonIds: ['L3'],
      montantEncaisse: 2000,
    };
    const r = await encaissementsApi.apercu(payload);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/encaissement/livraison/apercu', payload);
    expect(post.mock.calls[0][1].livraisonIds).toEqual(['L3']);
    expect(r.ecart).toBe(500);
    expect(r.surplusImpute[0].reference).toBe('LIV12');
  });

  it("création : POST /encaissement/livraison avec livraisonIds, sans libre ni dateDebut ; renvoie l'encaissement créé", async () => {
    post.mockResolvedValue({
      data: { id: 'e-1', reference: 'ENC-LIV4', montantEncaisse: 3000, ecart: -500, detteApres: 2000 },
    });
    const payload = {
      livreurId: 'l-1',
      clientId: 'c-1',
      livraisonIds: ['L1', 'L2'],
      montantEncaisse: 3000,
    };
    const r = await encaissementsApi.creer(payload);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/encaissement/livraison', payload);
    const corps = post.mock.calls[0][1];
    expect(corps.livraisonIds).toEqual(['L1', 'L2']);
    expect(corps).not.toHaveProperty('libre');
    expect(corps).not.toHaveProperty('dateDebut');
    expect(corps).not.toHaveProperty('dateFin');
    expect(get).not.toHaveBeenCalled();
    expect(r.reference).toBe('ENC-LIV4');
    expect(r.ecart).toBe(-500);
  });

  it('création : une erreur du back est propagée', async () => {
    post.mockRejectedValue({
      response: { status: 400, data: { success: false, message: 'Choisissez au moins une livraison à encaisser.' } },
    });
    await expect(
      encaissementsApi.creer({ livreurId: 'l-1', clientId: 'c-1', livraisonIds: [], montantEncaisse: 10 }),
    ).rejects.toBeTruthy();
  });

  it("l'API n'expose plus la situation sur une plage", () => {
    expect((encaissementsApi as Record<string, unknown>).situation).toBeUndefined();
  });
});

describe('contrat API encours (serveur)', () => {
  it('par livreur : GET /client/encours/livreur/{id}', async () => {
    get.mockResolvedValue({ data: [{ clientId: 'c-1', solde: -300, enDepassement: false }] });
    const r = await clientsApi.encoursByLivreur('l-1');
    expect(get).toHaveBeenCalledWith('/client/encours/livreur/l-1');
    expect(r[0].solde).toBe(-300);
  });

  it('par parent : GET /client/encours/parent/{id}', async () => {
    get.mockResolvedValue({ data: [] });
    await clientsApi.encoursByParent('p-1');
    expect(get).toHaveBeenCalledWith('/client/encours/parent/p-1');
  });

  it('client : GET /client/{id}/encours, dépassement tel que renvoyé par le serveur', async () => {
    get.mockResolvedValue({
      data: { clientId: 'c-1', solde: 10, limiteCredit: 0, enDepassement: true },
    });
    const r = await clientsApi.encours('c-1');
    expect(get).toHaveBeenCalledWith('/client/c-1/encours');
    expect(r.enDepassement).toBe(true);
  });
});
