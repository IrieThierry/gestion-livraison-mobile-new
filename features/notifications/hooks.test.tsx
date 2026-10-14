import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { apiClient } from '../../lib/api-client';
import { notificationKeys, useMarquerLue, useToutMarquerLu } from './hooks';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), put: jest.fn() } }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

const put = apiClient.put as jest.Mock;

function monter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

describe('mutations de lecture : annulation des relectures en vol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    put.mockResolvedValue({ data: 0 });
  });

  it('useMarquerLue annule fil et compteur avant la mise à jour optimiste', async () => {
    const { qc, wrapper } = monter();
    const annuler = jest.spyOn(qc, 'cancelQueries');
    const { result } = renderHook(() => useMarquerLue(), { wrapper });
    await act(async () => {
      result.current.mutate('n1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(annuler).toHaveBeenCalledWith({ queryKey: notificationKeys.fil() });
    expect(annuler).toHaveBeenCalledWith({ queryKey: notificationKeys.compte() });
  });

  it('useToutMarquerLu annule fil et compteur', async () => {
    const { qc, wrapper } = monter();
    const annuler = jest.spyOn(qc, 'cancelQueries');
    const { result } = renderHook(() => useToutMarquerLu(), { wrapper });
    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(annuler).toHaveBeenCalledWith({ queryKey: notificationKeys.fil() });
    expect(annuler).toHaveBeenCalledWith({ queryKey: notificationKeys.compte() });
  });
});
