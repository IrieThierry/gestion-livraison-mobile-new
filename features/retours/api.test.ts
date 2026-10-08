import { apiClient } from '../../lib/api-client';
import { derniersJours, moisEnCours, qteRetournable, retoursApi, valeurRetour } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

describe('valeurRetour / qteRetournable', () => {
  it('valeur = (prix + remise) × quantité', () => {
    expect(valeurRetour({ prixDeVente: 100, remiseUnitaire: 12.5 }, 4)).toBe(450);
    expect(valeurRetour({ prixDeVente: 100, remiseUnitaire: 0 }, 0)).toBe(0);
  });

  it('retournable = livré − déjà retourné, jamais négatif', () => {
    expect(qteRetournable({ qteLivre: 10, qteRetourne: 3 })).toBe(7);
    expect(qteRetournable({ qteLivre: 2, qteRetourne: 5 })).toBe(0);
  });
});

describe('moisEnCours', () => {
  it('du 1er du mois à aujourd’hui, en yyyy-MM-dd', () => {
    expect(moisEnCours(new Date(2026, 9, 8, 14, 30))).toEqual({
      debut: '2026-10-01',
      fin: '2026-10-08',
    });
  });
});

describe('derniersJours', () => {
  it('N derniers jours, aujourd’hui compris', () => {
    expect(derniersJours(30, new Date(2026, 9, 8))).toEqual({ debut: '2026-09-09', fin: '2026-10-08' });
  });
});

describe('retoursApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enregistrer : POST /retour avec {livraisonId, lignes}', async () => {
    post.mockResolvedValue({ data: { retours: [], livraison: { id: 'liv-1' } } });
    const res = await retoursApi.enregistrer({
      livraisonId: 'liv-1',
      lignes: [{ produitLivraisonId: 'pl-1', quantite: 2, remisEnStock: true }],
    });
    expect(post).toHaveBeenCalledWith('/retour', {
      livraisonId: 'liv-1',
      lignes: [{ produitLivraisonId: 'pl-1', quantite: 2, remisEnStock: true }],
    });
    expect(res.livraison.id).toBe('liv-1');
  });

  it('lister : GET /retour avec les filtres en paramètres', async () => {
    const page = { contenu: [], page: 1, taille: 50, total: 0 };
    get.mockResolvedValue({ data: page });
    const filtres = { debut: '2026-10-01', fin: '2026-10-08', clientId: 'c-1', page: 1 };
    await expect(retoursApi.lister(filtres)).resolves.toEqual(page);
    expect(get).toHaveBeenCalledWith('/retour', { params: filtres });
  });
});
