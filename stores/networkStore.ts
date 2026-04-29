import { create } from 'zustand';
import * as Network from 'expo-network';

interface NetworkState {
  isOnline: boolean;
  startWatching: () => void;
}

let started = false;

export const useNetworkStore = create<NetworkState>()((set) => ({
  isOnline: true,
  startWatching: () => {
    if (started) return;
    started = true;
    const tick = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const online = !!(state.isConnected && state.isInternetReachable !== false);
        set({ isOnline: online });
      } catch {
        set({ isOnline: false });
      }
    };
    tick();
    setInterval(tick, 5000);
  },
}));
