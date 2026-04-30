import { livraisonSchema, encaisserLivraisonSchema } from './schemas';

describe('livraisonSchema', () => {
  const valid = {
    livreurId: 'livreur-1',
    clientId: 'client-1',
    avecRemise: false,
    produitsLivraison: [
      { produitId: 'p1', qteLivree: 3, qteRetournee: 0, prixDeVente: 1500 },
    ],
  };

  it('accepts a complete valid payload', () => {
    expect(livraisonSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty produitsLivraison array', () => {
    expect(
      livraisonSchema.safeParse({ ...valid, produitsLivraison: [] }).success,
    ).toBe(false);
  });

  it('rejects missing livreurId', () => {
    expect(
      livraisonSchema.safeParse({ ...valid, livreurId: '' }).success,
    ).toBe(false);
  });

  it('rejects missing clientId', () => {
    expect(
      livraisonSchema.safeParse({ ...valid, clientId: '' }).success,
    ).toBe(false);
  });

  it('rejects qteLivree < 1', () => {
    expect(
      livraisonSchema.safeParse({
        ...valid,
        produitsLivraison: [{ ...valid.produitsLivraison[0], qteLivree: 0 }],
      }).success,
    ).toBe(false);
  });

  it('coerces string numbers in lignes (qteLivree, prixDeVente)', () => {
    const result = livraisonSchema.safeParse({
      ...valid,
      produitsLivraison: [
        { produitId: 'p1', qteLivree: '3', qteRetournee: '0', prixDeVente: '1500' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative prixDeVente', () => {
    expect(
      livraisonSchema.safeParse({
        ...valid,
        produitsLivraison: [{ ...valid.produitsLivraison[0], prixDeVente: -1 }],
      }).success,
    ).toBe(false);
  });
});

describe('encaisserLivraisonSchema', () => {
  const valid = {
    livreurId: 'livreur-1',
    clientId: 'client-1',
    livraisonIds: ['liv-1'],
    montantEncaisse: 5000,
    commentaire: '',
  };

  it('accepts a complete valid payload', () => {
    expect(encaisserLivraisonSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty livraisonIds', () => {
    expect(
      encaisserLivraisonSchema.safeParse({ ...valid, livraisonIds: [] }).success,
    ).toBe(false);
  });

  it('rejects montantEncaisse of 0', () => {
    expect(
      encaisserLivraisonSchema.safeParse({ ...valid, montantEncaisse: 0 }).success,
    ).toBe(false);
  });
});
