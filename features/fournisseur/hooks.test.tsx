import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { fournisseurMeApi } from './api';
import { useEnregistrerPrixParticulier } from './hooks';

jest.mock('./api', () => ({ fournisseurMeApi: { enregistrerPrixParticulier: jest.fn() } }));
jest.mock('../../lib/api-client', () => ({ apiClient: {} }));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { profile: 'FOURNISSEUR' } }),
}));

describe('FM2 : message du prix particulier robuste au remontage de la ligne', () => {
  it('apresSucces est appelé même si l’écran qui a lancé l’envoi est démonté avant la réponse', async () => {
    let repondre: (v: unknown) => void = () => {};
    (fournisseurMeApi.enregistrerPrixParticulier as jest.Mock).mockReturnValue(
      new Promise((r) => {
        repondre = r;
      }),
    );
    const qc = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const apresSucces = jest.fn();
    const rappelMutate = jest.fn();
    const { result, unmount } = renderHook(() => useEnregistrerPrixParticulier(apresSucces), { wrapper });
    act(() => {
      result.current.mutate({ pfId: 'pf1', livreurId: 'l1', prix: 850 }, { onSuccess: rappelMutate });
    });
    unmount();
    await act(async () => {
      repondre({});
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(apresSucces).toHaveBeenCalledTimes(1);
    // Le rappel de mutate() est perdu au démontage : d'où le message au niveau du hook.
    expect(rappelMutate).not.toHaveBeenCalled();
  });
});
