import { useQueryClient } from '@tanstack/react-query';
import { useMettreAZeroStock } from './hooks';
import { stockApi } from './api';
import { stockKeys } from './keys';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts) => opts),
  useMutation: jest.fn((opts) => opts),
  useQueryClient: jest.fn(),
}));
jest.mock('./api', () => ({
  stockApi: { mettreAZero: jest.fn() },
}));

const invalidateQueries = jest.fn();
(useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });

type Opts = {
  mutationFn: (v: unknown) => Promise<unknown>;
  onSuccess: () => void;
};

beforeEach(() => jest.clearAllMocks());

describe('useMettreAZeroStock', () => {
  it('appelle la route avec le livreur, le produit et le corps', async () => {
    const opts = useMettreAZeroStock() as unknown as Opts;
    await opts.mutationFn({ livreurId: 'app-1', produitId: 'p-1', payload: { motif: 'PERIME' } });
    expect(stockApi.mettreAZero).toHaveBeenCalledWith('app-1', 'p-1', { motif: 'PERIME' });
  });

  it('après succès : invalide tout le stock (courant, équipe, historique)', () => {
    const opts = useMettreAZeroStock() as unknown as Opts;
    opts.onSuccess();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: stockKeys.all });
    // Les clés courant, équipe et historique sont toutes sous `stockKeys.all`.
    for (const cle of [stockKeys.courant(), stockKeys.equipe(), stockKeys.historique('liv-1', {})]) {
      expect(cle.slice(0, stockKeys.all.length)).toEqual([...stockKeys.all]);
    }
  });
});
