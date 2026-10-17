import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { JetonsSession } from '../../lib/jetons-session';
import { useTempsReelStore } from './connexion';
import { useTempsReel, useTempsReelConnecte } from './useTempsReel';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }));

class FauxWebSocket {
  static instances: FauxWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FauxWebSocket.instances.push(this);
  }
  send() {}
  close() {
    this.closed = true;
  }
}
const dernier = () => FauxWebSocket.instances[FauxWebSocket.instances.length - 1];
const vider = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

let ecouteur: ((s: string) => void) | null = null;
const retirer = jest.fn();

function monter() {
  const qc = new QueryClient();
  const invalider = jest.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { invalider, wrapper };
}
const connecterUtilisateur = (id: string | null) => useAuthStore.setState({ user: id ? ({ id } as never) : null });

beforeEach(() => {
  FauxWebSocket.instances = [];
  (global as unknown as { WebSocket: unknown }).WebSocket = FauxWebSocket;
  jest.spyOn(JetonsSession, 'get').mockResolvedValue('jwt');
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (s: string) => void) => {
    ecouteur = fn;
    return { remove: retirer };
  }) as never);
  (AppState as { currentState: string }).currentState = 'active';
  useTempsReelStore.setState({ connecte: false });
  retirer.mockClear();
  connecterUtilisateur(null);
});
afterEach(() => jest.restoreAllMocks());

describe('useTempsReel', () => {
  it('ne se connecte pas sans utilisateur', async () => {
    const { wrapper } = monter();
    renderHook(() => useTempsReel(), { wrapper });
    await vider();
    expect(FauxWebSocket.instances.length).toBe(0);
  });

  it('se connecte pour un utilisateur, expose connecte après pret, se ferme à la déconnexion', async () => {
    connecterUtilisateur('u1');
    const { wrapper } = monter();
    const { result } = renderHook(
      () => {
        useTempsReel();
        return useTempsReelConnecte();
      },
      { wrapper },
    );
    await vider();
    expect(FauxWebSocket.instances.length).toBe(1);
    const ws = dernier();
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'pret' }) });
    });
    expect(result.current).toBe(true);
    act(() => connecterUtilisateur(null));
    expect(ws.closed).toBe(true);
    expect(result.current).toBe(false);
    expect(retirer).toHaveBeenCalled();
  });

  it('notification : invalide les notifications, et la localisation pour LOCALISATION_/DEMANDE_LOCALISATION', async () => {
    connecterUtilisateur('u1');
    const { wrapper, invalider } = monter();
    renderHook(() => useTempsReel(), { wrapper });
    await vider();
    const ws = dernier();
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'notification', id: '1', notificationType: 'LIVRAISON_X' }) });
    });
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(invalider).not.toHaveBeenCalledWith({ queryKey: ['localisation'] });
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'notification', id: '2', notificationType: 'DEMANDE_LOCALISATION' }) });
    });
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['localisation'] });
    invalider.mockClear();
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'notification', id: '3', notificationType: 'LOCALISATION_PARTAGEE' }) });
    });
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['localisation'] });
  });

  it('notification de remise du commis ou de commande terminée : relit les commandes (remises comprises)', async () => {
    connecterUtilisateur('u1');
    const { wrapper, invalider } = monter();
    renderHook(() => useTempsReel(), { wrapper });
    await vider();
    const ws = dernier();
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'notification', id: '1', notificationType: 'LIVRAISON_X' }) });
    });
    expect(invalider).not.toHaveBeenCalledWith({ queryKey: ['commandes'] });
    for (const type of ['REMISE_COMMIS_A_CONFIRMER', 'COMMANDE_TERMINEE']) {
      invalider.mockClear();
      act(() => {
        ws.onmessage?.({ data: JSON.stringify({ type: 'notification', id: type, notificationType: type }) });
      });
      expect(invalider).toHaveBeenCalledWith({ queryKey: ['commandes'] });
    }
  });

  it('pret : invalide notifications et localisation (trou avant pret)', async () => {
    connecterUtilisateur('u1');
    const { wrapper, invalider } = monter();
    renderHook(() => useTempsReel(), { wrapper });
    await vider();
    act(() => {
      dernier().onmessage?.({ data: JSON.stringify({ type: 'pret' }) });
    });
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['localisation'] });
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['commandes', 'remises-a-confirmer'] });
    invalider.mockClear();
    act(() => {
      dernier().onmessage?.({ data: JSON.stringify({ type: 'ping' }) });
    });
    expect(invalider).not.toHaveBeenCalled();
  });

  it('AppState background : ferme sans reconnexion ; active : se reconnecte', async () => {
    connecterUtilisateur('u1');
    const { wrapper } = monter();
    renderHook(() => useTempsReel(), { wrapper });
    await vider();
    const ws = dernier();
    act(() => ecouteur?.('background'));
    expect(ws.closed).toBe(true);
    await vider();
    expect(FauxWebSocket.instances.length).toBe(1);
    act(() => ecouteur?.('active'));
    await vider();
    expect(FauxWebSocket.instances.length).toBe(2);
  });

  it('démarre en pause si l app est déjà en arrière-plan', async () => {
    connecterUtilisateur('u1');
    (AppState as { currentState: string }).currentState = 'background';
    const { wrapper } = monter();
    renderHook(() => useTempsReel(), { wrapper });
    await vider();
    expect(FauxWebSocket.instances.length).toBe(0);
    act(() => ecouteur?.('active'));
    await vider();
    expect(FauxWebSocket.instances.length).toBe(1);
  });
});
