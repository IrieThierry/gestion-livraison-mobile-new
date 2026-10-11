import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { versementsApi } from './api';
import { useEnregistrerVersement } from './hooks';
import { versementKeys } from './keys';

jest.mock('./api', () => ({ versementsApi: { enregistrer: jest.fn() } }));

describe('useEnregistrerVersement', () => {
  it('invalide la liste « Mes versements » du livreur', async () => {
    (versementsApi.enregistrer as jest.Mock).mockResolvedValue({ id: 'v-1' });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
    qc.setQueryData(versementKeys.livreur('l-1'), []);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useEnregistrerVersement(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ livreurId: 'l-1', fournisseurId: 'f-1', montantVerse: 1000 });
    });
    await waitFor(() =>
      expect(qc.getQueryState(versementKeys.livreur('l-1'))?.isInvalidated).toBe(true),
    );
  });
});
