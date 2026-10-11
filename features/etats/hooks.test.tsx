import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { etatsApi } from './api';
import { useEtatStock, useEtatVentes, type ParamsEtat } from './hooks';
import { mouvement } from './calculs/etats.fixture';

jest.mock('./api', () => ({
  etatsApi: {
    livraisons: jest.fn(),
    stockEquipe: jest.fn(),
    stockLivreur: jest.fn(),
    mouvements: jest.fn(),
  },
}));

const api = etatsApi as jest.Mocked<typeof etatsApi>;
const P = { debut: '2026-10-01', fin: '2026-10-31' };
const user = { id: 'p', prenom: 'Awa', nom: 'Kone', parentId: null };
const apprentis = [{ id: 'a1', prenom: 'Moussa', nom: 'Sy' }] as unknown as ParamsEtat['apprentis'];

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

describe('hooks des états', () => {
  it('période invalide : aucune lecture, aucun document', () => {
    const { result } = renderHook(
      () => useEtatVentes({ user, choix: { type: 'moi' }, periode: null, libelleLivreur: 'Awa Kone', apprentis: [] }),
      { wrapper },
    );
    expect(api.livraisons).not.toHaveBeenCalled();
    expect(result.current.document).toBeNull();
  });

  it('ventes : document construit sur la période, en-tête du livreur', async () => {
    api.livraisons.mockResolvedValue([]);
    const { result } = renderHook(
      () => useEtatVentes({ user, choix: { type: 'moi' }, periode: P, libelleLivreur: 'Awa Kone', apprentis: [] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.document).not.toBeNull());
    expect(api.livraisons).toHaveBeenCalledWith({ mode: 'livreur', livreurId: 'p' }, P);
    expect(result.current.document?.livreur).toBe('Awa Kone');
    expect(result.current.document?.sections[0].lignes).toEqual([]);
  });

  it('stock en vue équipe : mouvements du principal et de chaque apprenti, livreur indiqué', async () => {
    api.stockEquipe.mockResolvedValue([]);
    api.mouvements.mockImplementation(async (id) =>
      id === 'a1'
        ? [mouvement('AJUSTEMENT', '2026-10-06T09:00:00', -2, 'Eau', 'Casse')]
        : [mouvement('RECEPTION', '2026-10-02T09:00:00', 10, 'Eau', 'REC-1')],
    );
    const { result } = renderHook(
      () =>
        useEtatStock({
          user,
          choix: { type: 'equipe' },
          periode: P,
          libelleLivreur: 'Équipe de Awa Kone',
          apprentis,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.document).not.toBeNull());
    expect(api.mouvements).toHaveBeenCalledWith('p', P);
    expect(api.mouvements).toHaveBeenCalledWith('a1', P);
    const detail = result.current.document!.sections.find((s) => s.titre === 'Détail des mouvements')!;
    expect(detail.colonnes.map((c) => c.libelle)).toContain('Livreur');
    expect(detail.lignes.map((l) => l[1])).toEqual(['Awa Kone', 'Moussa Sy']);
    expect(detail.lignes[1]).toContain('Ajustement');
  });
});
