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

  it('création : POST /encaissement/livraison, montant décimal au-delà du dû, mode libre', async () => {
    post.mockResolvedValue({ data: 'Encaissement enregistré avec succès !' });
    const payload = { livreurId: 'l-1', clientId: 'c-1', montantEncaisse: 12500.5, libre: true };
    await encaissementsApi.creer(payload);
    expect(post).toHaveBeenCalledWith('/encaissement/livraison', payload);
  });

  it('creerEtRelire : relit la liste du livreur et renvoie le dernier encaissement du client (detteApres serveur)', async () => {
    post.mockResolvedValue({ data: 'ok' });
    get.mockResolvedValue({
      data: [
        { id: 'a', reference: 'ENC-LIV3', client: { id: 'c-1' }, detteApres: 1000 },
        { id: 'b', reference: 'ENC-LIV4', client: { id: 'c-1' }, detteApres: -200 },
        { id: 'c', reference: 'ENC-LIV5', client: { id: 'c-9' }, detteApres: 0 },
      ],
    });
    const r = await encaissementsApi.creerEtRelire({
      livreurId: 'l-1',
      clientId: 'c-1',
      montantEncaisse: 1200,
      libre: true,
    });
    expect(get).toHaveBeenCalledWith('/encaissement/livraison/livreur/l-1');
    expect(r?.id).toBe('b');
    expect(r?.detteApres).toBe(-200);
  });

  it("creerEtRelire : un échec de relecture n'échoue pas la mutation (pas de doublon au rejeu)", async () => {
    post.mockResolvedValue({ data: 'ok' });
    get.mockRejectedValue(new Error('réseau'));
    await expect(
      encaissementsApi.creerEtRelire({ livreurId: 'l-1', clientId: 'c-1', montantEncaisse: 10 }),
    ).resolves.toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("creerEtRelire : un échec d'écriture est propagé sans relecture", async () => {
    post.mockRejectedValue({ response: { status: 400, data: { message: 'Montant invalide' } } });
    await expect(
      encaissementsApi.creerEtRelire({ livreurId: 'l-1', clientId: 'c-1', montantEncaisse: 10 }),
    ).rejects.toBeTruthy();
    expect(get).not.toHaveBeenCalled();
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
