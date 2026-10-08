import { useQueryClient } from '@tanstack/react-query';
import {
  useAffecterApprenti,
  useAnnulerReception,
  useModifierReception,
  usePasserLivree,
  useReceptionner,
} from './hooks';
import { commandesApi } from './api';
import { commandeKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { versementKeys } from '../versements/keys';
import { reversementKeys } from '../reversements/keys';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts) => opts),
  useMutation: jest.fn((opts) => opts),
  useQueryClient: jest.fn(),
}));
jest.mock('./api', () => ({
  commandesApi: {
    receptionner: jest.fn(),
    modifierReception: jest.fn(),
    annulerReception: jest.fn(),
    passerLivree: jest.fn(),
    affecterApprenti: jest.fn(),
  },
}));

const invalidateQueries = jest.fn();
(useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });

type Opts = {
  mutationFn: (v: unknown) => Promise<unknown>;
  onSuccess: () => void;
  onError: () => void;
};

function clesInvalidees(): unknown[] {
  return invalidateQueries.mock.calls.map((c) => c[0].queryKey);
}

beforeEach(() => jest.clearAllMocks());

describe('mutations de réception', () => {
  const cas: Array<[string, () => unknown, unknown, () => void]> = [
    [
      'useReceptionner',
      useReceptionner,
      { id: 'c-1', payload: { lignes: [{ produitId: 'p1', quantite: 2 }] } },
      () =>
        expect(commandesApi.receptionner).toHaveBeenCalledWith('c-1', {
          lignes: [{ produitId: 'p1', quantite: 2 }],
        }),
    ],
    [
      'useModifierReception',
      useModifierReception,
      { id: 'c-1', receptionId: 'r-1', payload: { lignes: [{ produitId: 'p1', quantite: 1 }] } },
      () =>
        expect(commandesApi.modifierReception).toHaveBeenCalledWith('c-1', 'r-1', {
          lignes: [{ produitId: 'p1', quantite: 1 }],
        }),
    ],
    [
      'useAnnulerReception',
      useAnnulerReception,
      { id: 'c-1', receptionId: 'r-1' },
      () => expect(commandesApi.annulerReception).toHaveBeenCalledWith('c-1', 'r-1'),
    ],
    [
      'usePasserLivree',
      usePasserLivree,
      'c-1',
      () => expect(commandesApi.passerLivree).toHaveBeenCalledWith('c-1'),
    ],
  ];

  it.each(cas)('%s appelle l’API attendue', async (_nom, hook, variables, verifier) => {
    const opts = hook() as Opts;
    await opts.mutationFn(variables);
    verifier();
  });

  it.each(cas)('%s : succès → invalide commandes, stock, versements et reversements', (_nom, hook) => {
    (hook() as Opts).onSuccess();
    expect(clesInvalidees()).toEqual(
      expect.arrayContaining([
        commandeKeys.all,
        stockKeys.all,
        versementKeys.all,
        reversementKeys.all,
      ]),
    );
  });

  it.each(cas)('%s : échec (400, 409) → recharge les commandes', (_nom, hook) => {
    (hook() as Opts).onError();
    expect(clesInvalidees()).toEqual([commandeKeys.all]);
  });
});

describe('useAffecterApprenti', () => {
  it('envoie l’apprenti (ou null) et recharge les commandes', async () => {
    const opts = useAffecterApprenti() as unknown as Opts;
    await opts.mutationFn({ id: 'c-1', apprentiId: null });
    expect(commandesApi.affecterApprenti).toHaveBeenCalledWith('c-1', null);
    opts.onSuccess();
    expect(clesInvalidees()).toEqual([commandeKeys.all]);
  });
});
