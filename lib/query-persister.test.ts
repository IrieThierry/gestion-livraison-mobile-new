import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryPersister, QUERY_CACHE_KEY } from './query-client';
import { JetonsSession } from './jetons-session';

const client = { timestamp: 1, buster: 'b', clientState: { queries: [], mutations: [] } };

beforeEach(async () => {
  await AsyncStorage.clear();
  JetonsSession.definirPersistance(true);
});
afterAll(() => JetonsSession.definirPersistance(true));

describe('cache persisté (M2, revue I1)', () => {
  it('session non gardée : rien n’est écrit sur le téléphone', async () => {
    JetonsSession.definirPersistance(false);
    await queryPersister.persistClient(client);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await AsyncStorage.getItem(QUERY_CACHE_KEY)).toBeNull();
  });

  it('démarrage sans utilisateur gardé : cache effacé, rien n’est restauré', async () => {
    await AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(client));
    expect(await queryPersister.restoreClient()).toBeUndefined();
    expect(await AsyncStorage.getItem(QUERY_CACHE_KEY)).toBeNull();
  });

  it('session gardée : cache restauré', async () => {
    await AsyncStorage.setItem('user', JSON.stringify({ id: 'u' }));
    await AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(client));
    expect(await queryPersister.restoreClient()).toEqual(client);
  });
});
