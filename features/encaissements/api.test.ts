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
  it('situation : GET /encaissement/livraison/situation avec les 4 paramètres', async () => {
    get.mockResolvedValue({
      data: { valeurLivraisons: 3000, margeCumulee: 150, detteAvant: 500, totalDu: 3500 },
    });
    const p = {
      livreurId: 'l-1',
      clientId: 'c-1',
      dateDebut: '2026-09-01T00:00:00',
      dateFin: '2026-10-04T23:59:59',
    };
    const r = await encaissementsApi.situation(p);
    expect(get).toHaveBeenCalledWith('/encaissement/livraison/situation', { params: p });
    expect(r.totalDu).toBe(3500);
  });

  it("création : POST /encaissement/livraison, montant décimal au-delà du dû, mode libre ; renvoie l'encaissement créé", async () => {
    post.mockResolvedValue({
      data: { id: 'e-1', reference: 'ENC-LIV4', montantEncaisse: 12500.5, detteAvant: 10000, detteApres: -2500.5 },
    });
    const payload = { livreurId: 'l-1', clientId: 'c-1', montantEncaisse: 12500.5, libre: true };
    const r = await encaissementsApi.creer(payload);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/encaissement/livraison', payload);
    expect(get).not.toHaveBeenCalled();
    expect(r.reference).toBe('ENC-LIV4');
    expect(r.detteApres).toBe(-2500.5);
  });

  it("création : une erreur du back est propagée", async () => {
    post.mockRejectedValue({ response: { status: 400, data: { message: 'Montant invalide' } } });
    await expect(
      encaissementsApi.creer({ livreurId: 'l-1', clientId: 'c-1', montantEncaisse: 10 }),
    ).rejects.toBeTruthy();
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
