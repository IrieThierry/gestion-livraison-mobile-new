import { useQueryClient } from '@tanstack/react-query';
import { useEnregistrerCloture } from './hooks';
import { cloturesApi } from './api';
import { remiseArgentKeys } from '../remises-argent/keys';
import { encoursKeys } from '../clients/keys';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts) => opts),
  useMutation: jest.fn((opts) => opts),
  useQueryClient: jest.fn(),
}));
jest.mock('./api', () => ({
  cloturesApi: { enregistrer: jest.fn() },
}));

const invalidateQueries = jest.fn();
(useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });

type Opts = {
  mutationFn: (v: unknown) => Promise<unknown>;
  onSuccess: () => void;
};

beforeEach(() => jest.clearAllMocks());

describe('useEnregistrerCloture', () => {
  it('appelle la route avec le corps', async () => {
    const opts = useEnregistrerCloture() as unknown as Opts;
    await opts.mutationFn({ livreurId: 'a-1', montantRemis: 1000 });
    expect(cloturesApi.enregistrer).toHaveBeenCalledWith({ livreurId: 'a-1', montantRemis: 1000 });
  });

  it('après succès : relit aussi les remises d’argent (remise déclarée par la clôture d’un apprenti)', () => {
    const opts = useEnregistrerCloture() as unknown as Opts;
    opts.onSuccess();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: remiseArgentKeys.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: encoursKeys.all });
    // Mes remises, remises des apprentis et cloche sont toutes sous `remiseArgentKeys.all`.
    for (const cle of [remiseArgentKeys.miennes(), remiseArgentKeys.parent('p-1', { statut: 'DECLAREE' })]) {
      expect(cle.slice(0, remiseArgentKeys.all.length)).toEqual([...remiseArgentKeys.all]);
    }
  });
});
