import { apiClient } from '../../lib/api-client';
import { organisationApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: {} });
});

describe('organisationApi', () => {
  it('organisation du commercial : GET /organisation/me', async () => {
    await organisationApi.moi();
    expect(get).toHaveBeenCalledWith('/organisation/me');
  });

  it('demandes : liste (statut facultatif), création, annulation', async () => {
    await organisationApi.mesDemandes();
    expect(get).toHaveBeenLastCalledWith('/organisation/me/demandes-chargement/me', undefined);
    await organisationApi.mesDemandes('EN_ATTENTE');
    expect(get).toHaveBeenLastCalledWith('/organisation/me/demandes-chargement/me', { params: { statut: 'EN_ATTENTE' } });
    const corps = { lignes: [{ produitId: 'p1', quantite: 10 }] };
    await organisationApi.creerDemande(corps);
    expect(post).toHaveBeenLastCalledWith('/organisation/me/demandes-chargement', corps);
    await organisationApi.annulerDemande('d1');
    expect(post).toHaveBeenLastCalledWith('/organisation/me/demandes-chargement/d1/annuler');
  });

  it('factures : filtres non vides seulement, détail, facture d’une vente', async () => {
    await organisationApi.factures();
    expect(get).toHaveBeenLastCalledWith('/facture', undefined);
    await organisationApi.factures({ debut: '2026-10-01', fin: '2026-10-13', clientId: '' });
    expect(get).toHaveBeenLastCalledWith('/facture', { params: { debut: '2026-10-01', fin: '2026-10-13' } });
    await organisationApi.facture('f1');
    expect(get).toHaveBeenLastCalledWith('/facture/f1');

    get.mockResolvedValueOnce({ data: [{ id: 'f9', numero: 'FAC-2026-000001' }] });
    await expect(organisationApi.factureDeLivraison('l1')).resolves.toEqual({ id: 'f9', numero: 'FAC-2026-000001' });
    expect(get).toHaveBeenLastCalledWith('/facture', { params: { livraisonId: 'l1' } });
    get.mockResolvedValueOnce({ data: [] });
    await expect(organisationApi.factureDeLivraison('l2')).resolves.toBeNull();
  });

  it('avoirs : liste et détail', async () => {
    await organisationApi.avoirs({ factureId: 'f1' });
    expect(get).toHaveBeenLastCalledWith('/avoir', { params: { factureId: 'f1' } });
    await organisationApi.avoir('a1');
    expect(get).toHaveBeenLastCalledWith('/avoir/a1');
  });
});
