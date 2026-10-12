import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLivraisonsLivreurPeriode } from './hooks';
import { livraisonsApi } from './api';
import { livraisonKeys } from './keys';

jest.mock('./api', () => ({ livraisonsApi: { byLivreur: jest.fn() } }));

const byLivreur = livraisonsApi.byLivreur as jest.Mock;

describe('useLivraisonsLivreurPeriode', () => {
  it('hors ligne / en attente : liste complète en cache filtrée sur la période, puis réponse de la route', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    qc.setQueryData(livraisonKeys.byLivreur('liv-1'), [
      { id: 'a', date: '2026-10-12T09:00:00' },
      { id: 'b', date: '2026-10-01T09:00:00' },
    ]);
    let repondre: (v: unknown) => void = () => undefined;
    byLivreur.mockReturnValue(new Promise((ok) => (repondre = ok)));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const bornes = { debut: '2026-10-10', fin: '2026-10-12' };
    const { result } = renderHook(() => useLivraisonsLivreurPeriode('liv-1', bornes), { wrapper });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.map((l) => l.id)).toEqual(['a']);
    expect(byLivreur).toHaveBeenCalledWith('liv-1', bornes);

    repondre([{ id: 'a', date: '2026-10-12T09:00:00' }, { id: 'c', date: '2026-10-11T09:00:00' }]);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data?.map((l) => l.id)).toEqual(['a', 'c']);
  });
});
