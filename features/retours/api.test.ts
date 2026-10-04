import { apiClient } from '../../lib/api-client';
import { buildModifierPayload, qteRetournable, retoursApi, valeurRetour } from './api';
import type { LivraisonResponse, ProduitLivraisonResponse } from '../../types/api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { put: jest.fn() },
}));

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
    statutEncaissement: 'ENCAISSEE',
    montantLivre: 1000,
    montantDu: 0,
    remiseNette: 0,
    avecRemise: true,
  };
}

describe('buildModifierPayload', () => {
  const liv = livraison([
    ligne({ id: 'pl-1', produit: { id: 'p-1' } as never, qteRetourne: 2, qteRetourneeEnStock: 1 }),
    ligne({
      id: 'pl-2',
      produit: { id: 'p-2' } as never,
      qteLivre: 5,
      qteRetourne: 3,
      qteRetourneeEnStock: 2,
      prixDeVente: 250,
    }),
  ]);

  it('remise en stock : qteRetournee ET qteRetourneeEnStock augmentent de la quantité', () => {
    const p = buildModifierPayload(liv, {
      livraisonId: 'liv-1',
      lignes: [{ produitLivraisonId: 'pl-1', quantite: 3, remettreEnStock: true }],
    });
    expect(p.produitsLivraison[0]).toMatchObject({
      produitId: 'p-1',
      qteLivree: 10,
      qteRetournee: 5,
      qteRetourneeEnStock: 4,
      prixDeVente: 100,
    });
  });

  it('perdu : seule qteRetournee augmente, qteRetourneeEnStock garde l’ancienne valeur', () => {
    const p = buildModifierPayload(liv, {
      livraisonId: 'liv-1',
      lignes: [{ produitLivraisonId: 'pl-1', quantite: 3, remettreEnStock: false }],
    });
    expect(p.produitsLivraison[0]).toMatchObject({ qteRetournee: 5, qteRetourneeEnStock: 1 });
  });

  it('renvoie les valeurs existantes des autres lignes, qteRetourneeEnStock toujours explicite', () => {
    const p = buildModifierPayload(liv, {
      livraisonId: 'liv-1',
      lignes: [{ produitLivraisonId: 'pl-1', quantite: 1, remettreEnStock: true }],
    });
    expect(p.produitsLivraison[1]).toEqual({
      produitId: 'p-2',
      qteLivree: 5,
      qteRetournee: 3,
      qteRetourneeEnStock: 2,
      prixDeVente: 250,
      memoriserPrixClient: false,
    });
    for (const l of p.produitsLivraison) {
      expect(l.qteRetourneeEnStock).toEqual(expect.any(Number));
      expect(l).not.toHaveProperty('remiseUnitaire');
    }
  });

  it('conserve client, livreur, id et avecRemise de la livraison', () => {
    const p = buildModifierPayload(liv, { livraisonId: 'liv-1', lignes: [] });
    expect(p).toMatchObject({ id: 'liv-1', clientId: 'c-1', livreurId: 'l-1', avecRemise: true });
  });

  it('cumule plusieurs saisies sur la même ligne (stock et perdu)', () => {
    const p = buildModifierPayload(liv, {
      livraisonId: 'liv-1',
      lignes: [
        { produitLivraisonId: 'pl-1', quantite: 2, remettreEnStock: true },
        { produitLivraisonId: 'pl-1', quantite: 1, remettreEnStock: false },
      ],
    });
    expect(p.produitsLivraison[0]).toMatchObject({ qteRetournee: 5, qteRetourneeEnStock: 3 });
  });
});

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

describe('retoursApi.enregistrer', () => {
  it('PUT /livraison avec le payload complet', async () => {
    put.mockResolvedValue({ data: 'ok' });
    const liv = livraison([ligne({})]);
    await retoursApi.enregistrer(liv, {
      livraisonId: 'liv-1',
      lignes: [{ produitLivraisonId: 'pl-1', quantite: 2, remettreEnStock: true }],
    });
    expect(put).toHaveBeenCalledWith(
      '/livraison',
      expect.objectContaining({
        id: 'liv-1',
        produitsLivraison: [
          expect.objectContaining({ qteRetournee: 2, qteRetourneeEnStock: 2 }),
        ],
      }),
    );
  });
});
