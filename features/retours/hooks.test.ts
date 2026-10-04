import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { livraisonKeys } from '../livraisons/keys';
import { enregistrerRetourSurDonneesFraiches } from './hooks';
import type { LivraisonResponse, ProduitLivraisonResponse } from '../../types/api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), put: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;

function ligne(over: Partial<ProduitLivraisonResponse>): ProduitLivraisonResponse {
  return {
    id: 'pl-1',
    produit: { id: 'p-1' } as ProduitLivraisonResponse['produit'],
    qteLivre: 10,
    qteRetourne: 0,
    prixDeVente: 100,
    margeUnitaire: 0,
    qteRetourneeEnStock: 0,
    remiseUnitaire: 0,
    ...over,
  };
}

function livraison(lignes: ProduitLivraisonResponse[]): LivraisonResponse {
  return {
    id: 'liv-1',
    reference: 'LIV-1',
    client: { id: 'c-1' } as LivraisonResponse['client'],
    livreur: { id: 'l-1' } as LivraisonResponse['livreur'],
    date: '2026-10-01T00:00:00',
    produitsLivraison: lignes,
    statut: 'LIVREE',
    statutEncaissement: 'NON_ENCAISSEE',
    montantLivre: 1000,
    montantDu: 1000,
    remiseNette: 0,
    avecRemise: false,
  };
}

describe('enregistrerRetourSurDonneesFraiches', () => {
  let qc: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  afterEach(() => {
    qc.clear();
  });

  it('construit le PUT sur les quantités fraîches du serveur, pas sur le cache', async () => {
    const enCache = livraison([ligne({ qteRetourne: 2, qteRetourneeEnStock: 2 })]);
    qc.setQueryData(livraisonKeys.byLivreur('l-1'), [enCache]);
    // Entre-temps, un autre retour (1 perdu) a été enregistré côté serveur.
    get.mockResolvedValue({
      data: [livraison([ligne({ qteRetourne: 3, qteRetourneeEnStock: 2 })])],
    });
    put.mockResolvedValue({ data: 'ok' });

    await enregistrerRetourSurDonneesFraiches(qc, {
      livraison: enCache,
      request: {
        livraisonId: 'liv-1',
        lignes: [{ produitLivraisonId: 'pl-1', quantite: 1, remettreEnStock: true }],
      },
    });

    expect(get).toHaveBeenCalledWith('/livraison/livraison-livreur/l-1');
    const body = put.mock.calls[0][1];
    expect(body.produitsLivraison[0]).toMatchObject({ qteRetournee: 4, qteRetourneeEnStock: 3 });
  });

  it('refuse si la quantité dépasse le retournable des données fraîches', async () => {
    const enCache = livraison([ligne({ qteRetourne: 0 })]);
    get.mockResolvedValue({ data: [livraison([ligne({ qteRetourne: 9 })])] });

    await expect(
      enregistrerRetourSurDonneesFraiches(qc, {
        livraison: enCache,
        request: {
          livraisonId: 'liv-1',
          lignes: [
            { produitLivraisonId: 'pl-1', quantite: 1, remettreEnStock: true },
            { produitLivraisonId: 'pl-1', quantite: 1, remettreEnStock: false },
          ],
        },
      }),
    ).rejects.toThrow('Quantité retournable dépassée');
    expect(put).not.toHaveBeenCalled();
  });

  it('refuse si la livraison a disparu côté serveur', async () => {
    const enCache = livraison([ligne({})]);
    get.mockResolvedValue({ data: [] });

    await expect(
      enregistrerRetourSurDonneesFraiches(qc, {
        livraison: enCache,
        request: {
          livraisonId: 'liv-1',
          lignes: [{ produitLivraisonId: 'pl-1', quantite: 1, remettreEnStock: true }],
        },
      }),
    ).rejects.toThrow('Livraison introuvable');
    expect(put).not.toHaveBeenCalled();
  });
});
