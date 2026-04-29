import { apiClient } from '../../lib/api-client';
import type { AuthResponse, LoginRequest } from '../../types/api';
import type { LoginInput } from './schemas';

// Le back renvoie une réponse plate (pas d'objet user imbriqué) — on extrait
// la portion "user" depuis AuthResponse pour le store.
export type AuthUser = Omit<AuthResponse, 'token'>;

export const authApi = {
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const payload: LoginRequest = { username: input.username, password: input.password };
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },
};
