import { apiClient } from '../../lib/api-client';
import { commandesApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const put = apiClient.put as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: { id: 'c1' } });
  put.mockResolvedValue({ data: { id: 'c1' } });
});

describe('contrat API commandes', () => {
  it('liste mes commandes', async () => {
    await commandesApi.mes();
    expect(get).toHaveBeenCalledWith('/commande/me');
  });

  it('liste les commandes à régler chez un fournisseur', async () => {
    await commandesApi.aRegler('f-1');
    expect(get).toHaveBeenCalledWith('/commande/a-regler', { params: { fournisseurId: 'f-1' } });
  });

  it("lit le catalogue d'un fournisseur", async () => {
    await commandesApi.catalogue('f-1');
    expect(get).toHaveBeenCalledWith('/produit-fournisseur', { params: { fournisseurId: 'f-1' } });
  });

  it('renvoie les champs remise livreur, actif et prix particulier du catalogue', async () => {
    get.mockResolvedValue({
      data: [{ id: 'pf1', prixDeVente: 140, remiseLivreur: 10, actif: true, prixParticulier: true }],
    });
    const lignes = await commandesApi.catalogue('f-1');
    expect(lignes[0]).toMatchObject({ remiseLivreur: 10, actif: true, prixParticulier: true });
  });

  it('crée une commande avec le corps attendu', async () => {
    const payload = { fournisseurId: 'f-1', produitsCommandes: [{ produitId: 'p1', qteCommandee: 3 }] };
    await commandesApi.creer(payload);
    expect(post).toHaveBeenCalledWith('/commande', payload);
  });

  it('annule une commande', async () => {
    await commandesApi.annuler('c-9');
    expect(post).toHaveBeenCalledWith('/commande/c-9/annuler');
  });

  it('crée une commande avec un apprenti affecté', async () => {
    const payload = {
      fournisseurId: 'f-1',
      produitsCommandes: [{ produitId: 'p1', qteCommandee: 3 }],
      apprentiId: 'a-1',
    };
    await commandesApi.creer(payload);
    expect(post).toHaveBeenCalledWith('/commande', payload);
  });
});

describe('contrat API réceptions et affectation', () => {
  it('lit le détail, les commandes à réceptionner et l’historique des réceptions', async () => {
    await commandesApi.detail('c-1');
    expect(get).toHaveBeenCalledWith('/commande/c-1');
    await commandesApi.aReceptionner();
    expect(get).toHaveBeenCalledWith('/commande/a-receptionner');
    await commandesApi.receptions('c-1');
    expect(get).toHaveBeenCalledWith('/commande/c-1/receptions');
  });

  it('réceptionne : POST /commande/{id}/receptions avec lignes et date', async () => {
    const payload = {
      dateReception: '2026-10-05T00:00:00',
      lignes: [{ produitId: 'p1', quantite: 6 }],
    };
    await commandesApi.receptionner('c-1', payload);
    expect(post).toHaveBeenCalledWith('/commande/c-1/receptions', payload);
  });

  it('réceptionne sans date (maintenant côté serveur)', async () => {
    const payload = { lignes: [{ produitId: 'p1', quantite: 2 }] };
    await commandesApi.receptionner('c-1', payload);
    expect(post).toHaveBeenCalledWith('/commande/c-1/receptions', { lignes: [{ produitId: 'p1', quantite: 2 }] });
  });

  it('modifie une réception : PUT avec le contenu complet', async () => {
    const payload = {
      lignes: [
        { produitId: 'p1', quantite: 4 },
        { produitId: 'p3', quantite: 3 },
      ],
    };
    await commandesApi.modifierReception('c-1', 'r-1', payload);
    expect(put).toHaveBeenCalledWith('/commande/c-1/receptions/r-1', payload);
  });

  it('annule une réception : POST …/annuler sans corps', async () => {
    await commandesApi.annulerReception('c-1', 'r-1');
    expect(post).toHaveBeenCalledWith('/commande/c-1/receptions/r-1/annuler');
  });

  it('passe une commande à Livrée : POST …/passer-livree sans corps', async () => {
    await commandesApi.passerLivree('c-1');
    expect(post).toHaveBeenCalledWith('/commande/c-1/passer-livree');
  });

  it('affecte ou retire un apprenti : PUT …/apprenti', async () => {
    await commandesApi.affecterApprenti('c-1', 'a-1');
    expect(put).toHaveBeenCalledWith('/commande/c-1/apprenti', { apprentiId: 'a-1' });
    await commandesApi.affecterApprenti('c-1', null);
    expect(put).toHaveBeenCalledWith('/commande/c-1/apprenti', { apprentiId: null });
  });

  it('liste les apprentis affectables chez un fournisseur', async () => {
    await commandesApi.apprentisAffectables('f-1');
    expect(get).toHaveBeenCalledWith('/commande/apprentis-affectables', {
      params: { fournisseurId: 'f-1' },
    });
  });
});
