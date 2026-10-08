import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnregistrerRetour, useRetours } from './hooks';
import { retoursApi } from './api';
import { retourKeys } from './keys';
import { livraisonKeys } from '../livraisons/keys';
import { stockKeys } from '../stock/keys';
import { encaissementKeys } from '../encaissements/keys';
import { clientKeys, encoursKeys } from '../clients/keys';

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn((opts) => opts),
  useMutation: jest.fn((opts) => opts),
  useQueryClient: jest.fn(),
}));
jest.mock('./api', () => ({
  retoursApi: { lister: jest.fn(), enregistrer: jest.fn() },
}));

const invalidateQueries = jest.fn();
(useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });

function clesInvalidees(): unknown[] {
  return invalidateQueries.mock.calls.map((c) => c[0].queryKey);
}

describe('useEnregistrerRetour', () => {
  beforeEach(() => jest.clearAllMocks());

  it('poste le payload tel quel', async () => {
    const opts = useEnregistrerRetour() as unknown as {
      mutationFn: (p: unknown) => Promise<unknown>;
    };
    (retoursApi.enregistrer as jest.Mock).mockResolvedValue('ok');
    const payload = {
      livraisonId: 'liv-1',
      lignes: [{ produitLivraisonId: 'pl-1', quantite: 1, remisEnStock: false }],
    };
    await opts.mutationFn(payload);
    expect(retoursApi.enregistrer).toHaveBeenCalledWith(payload);
    expect(useMutation).toHaveBeenCalled();
  });

  it('succès : invalide retours, livraisons, stock, encaissements, clients et encours', () => {
    const opts = useEnregistrerRetour() as unknown as { onSuccess: () => void };
    opts.onSuccess();
    const cles = clesInvalidees();
    expect(cles).toEqual(
      expect.arrayContaining([
        retourKeys.all,
        livraisonKeys.all,
        stockKeys.all,
        encaissementKeys.all,
        clientKeys.all,
        encoursKeys.all,
      ]),
    );
  });

  it('échec (ex. 409) : recharge livraisons et journal', () => {
    const opts = useEnregistrerRetour() as unknown as { onError: () => void };
    opts.onError();
    expect(clesInvalidees()).toEqual(
      expect.arrayContaining([livraisonKeys.all, retourKeys.all]),
    );
  });
});

describe('useRetours', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lit la page demandée avec les filtres, à partir de 0', async () => {
    const filtres = { debut: '2026-10-01', fin: '2026-10-08' };
    const opts = useRetours(filtres) as unknown as {
      queryKey: unknown;
      initialPageParam: number;
      queryFn: (c: { pageParam: number }) => Promise<unknown>;
      getNextPageParam: (p: { page: number; taille: number; total: number }) => number | undefined;
    };
    expect(useInfiniteQuery).toHaveBeenCalled();
    expect(opts.queryKey).toEqual(retourKeys.liste(filtres));
    expect(opts.initialPageParam).toBe(0);
    await opts.queryFn({ pageParam: 2 });
    expect(retoursApi.lister).toHaveBeenCalledWith({ ...filtres, page: 2 });
  });

  it('page suivante tant que (page+1) × taille < total', () => {
    const opts = useRetours({}) as unknown as {
      getNextPageParam: (p: { page: number; taille: number; total: number }) => number | undefined;
    };
    expect(opts.getNextPageParam({ page: 0, taille: 50, total: 51 })).toBe(1);
    expect(opts.getNextPageParam({ page: 1, taille: 50, total: 100 })).toBeUndefined();
  });
});
