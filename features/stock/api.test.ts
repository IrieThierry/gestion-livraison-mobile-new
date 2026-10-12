import { apiClient } from '../../lib/api-client';
import { stockApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

describe('stockApi.historique', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lit le journal du livreur avec les filtres en paramètres', async () => {
    const mouvements = [{ type: 'RECEPTION', quantite: 12 }];
    get.mockResolvedValue({ data: mouvements });

    const res = await stockApi.historique('liv-1', {
      debut: '2026-10-01',
      fin: '2026-10-08',
      produitId: 'p-1',
    });

    expect(res).toBe(mouvements);
    expect(get).toHaveBeenCalledWith('/stock-livreur/liv-1/historique', {
      params: { debut: '2026-10-01', fin: '2026-10-08', produitId: 'p-1' },
    });
  });

  it('sans filtre : aucun paramètre', async () => {
    get.mockResolvedValue({ data: [] });
    await stockApi.historique('liv-1');
    expect(get).toHaveBeenCalledWith('/stock-livreur/liv-1/historique', { params: {} });
  });

  it("n'expose plus l'achat manuel", () => {
    expect((stockApi as Record<string, unknown>).enregistrerAchat).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('stockApi.mettreAZero', () => {
  beforeEach(() => jest.clearAllMocks());

  it('envoie le motif et le commentaire sur la route du livreur et du produit', async () => {
    const reponse = { id: 'aj-1', quantiteRetiree: 7, motif: 'PERTE', motifLibelle: 'Perte' };
    post.mockResolvedValue({ data: reponse });

    const res = await stockApi.mettreAZero('app-1', 'p-1', { motif: 'PERTE', commentaire: 'Sac percé' });

    expect(res).toBe(reponse);
    expect(post).toHaveBeenCalledWith('/stock-livreur/app-1/produits/p-1/mise-a-zero', {
      motif: 'PERTE',
      commentaire: 'Sac percé',
    });
  });

  it('propage le refus du back (400 { message })', async () => {
    const erreur = { response: { status: 400, data: { message: 'Le stock de ce produit est déjà à zéro.' } } };
    post.mockRejectedValue(erreur);
    await expect(stockApi.mettreAZero('liv-1', 'p-1', { motif: 'CASSE' })).rejects.toBe(erreur);
  });
});

describe('stockApi.enTransit', () => {
  it('lit le stock en transit du livreur', async () => {
    const reponse = { lignes: [{ produit: { id: 'p1' }, sortant: 4, entrant: 0 }] };
    get.mockResolvedValue({ data: reponse });
    expect(await stockApi.enTransit('liv-1')).toBe(reponse);
    expect(get).toHaveBeenCalledWith('/stock-livreur/liv-1/en-transit');
  });
});
