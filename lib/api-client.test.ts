import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';
import { apiClient } from './api-client';
import { useAuthStore } from '../stores/authStore';
import { SecureStorage } from './secure-storage';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('./secure-storage', () => ({
  SecureStorage: { get: jest.fn(), set: jest.fn(), clearAuth: jest.fn() },
}));
jest.mock('../stores/authStore', () => {
  const logout = jest.fn(async () => undefined);
  return { useAuthStore: { getState: () => ({ logout }) } };
});

const logout = useAuthStore.getState().logout as jest.Mock;
const get = SecureStorage.get as jest.Mock;

/** Adaptateur simulé : 401 sur toute requête, sauf après un jeton rafraîchi. */
function adaptateur401(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const auth = String(config.headers?.Authorization ?? '');
  if (auth === 'Bearer nouveau') {
    return Promise.resolve({ data: 'ok', status: 200, statusText: 'OK', headers: {}, config });
  }
  const response = {
    data: { success: false, message: "Nom d'utilisateur ou mot de passe incorrect" },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  } as AxiosResponse;
  return Promise.reject(new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, {}, response));
}

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.defaults.adapter = adaptateur401;
});

describe('intercepteur 401', () => {
  it('/auth/login : erreur d’origine (401 et message du back), ni rafraîchissement ni déconnexion', async () => {
    const post = jest.spyOn(axios, 'post');
    get.mockResolvedValue('ancien-refresh');
    const err = await apiClient.post('/auth/login', { username: 'a', password: 'b' }).catch((e) => e);
    expect(err.response.status).toBe(401);
    expect(err.response.data.message).toBe("Nom d'utilisateur ou mot de passe incorrect");
    expect(post).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    post.mockRestore();
  });

  it('autre route : le jeton est rafraîchi puis la requête rejouée', async () => {
    // Stockage simulé : le jeton rafraîchi est relu par l'intercepteur de requête au rejeu.
    const stock: Record<string, string> = { access_token: 'expire', refresh_token: 'refresh-1' };
    get.mockImplementation(async (k: string) => stock[k]);
    (SecureStorage.set as jest.Mock).mockImplementation(async (k: string, v: string) => {
      stock[k] = v;
    });
    const post = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { token: 'nouveau', refreshToken: 'refresh-2' } });
    const res = await apiClient.get('/livraison');
    expect(res.data).toBe('ok');
    expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/refresh$/), { refreshToken: 'refresh-1' });
    expect(logout).not.toHaveBeenCalled();
    post.mockRestore();
  });
});
