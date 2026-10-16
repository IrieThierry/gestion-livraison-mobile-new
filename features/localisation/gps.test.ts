import * as Location from 'expo-location';
import { DELAI_GPS_MS, lireUnePosition } from './gps';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const demander = Location.requestForegroundPermissionsAsync as jest.Mock;
const lire = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  demander.mockResolvedValue({ status: 'granted' });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('lireUnePosition', () => {
  it('permission refusée : PERMISSION, sans lecture GPS', async () => {
    demander.mockResolvedValue({ status: 'denied' });
    await expect(lireUnePosition()).rejects.toThrow('PERMISSION');
    expect(lire).not.toHaveBeenCalled();
  });

  it('GPS jamais résolu : DELAI après 15 s', async () => {
    jest.useFakeTimers();
    lire.mockReturnValue(new Promise(() => {}));
    const p = lireUnePosition();
    const attente = expect(p).rejects.toThrow('DELAI');
    await jest.advanceTimersByTimeAsync(DELAI_GPS_MS - 1);
    let fini = false;
    p.catch(() => {
      fini = true;
    });
    await Promise.resolve();
    expect(fini).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await attente;
    expect(DELAI_GPS_MS).toBe(15_000);
  });

  it('succès : une seule lecture, précision équilibrée, "lat,lng"', async () => {
    lire.mockResolvedValue({ coords: { latitude: 5.3500004, longitude: -4.0099996 } });
    await expect(lireUnePosition()).resolves.toBe('5.35,-4.01');
    expect(lire).toHaveBeenCalledTimes(1);
    expect(lire).toHaveBeenCalledWith({ accuracy: 3 });
  });
});
