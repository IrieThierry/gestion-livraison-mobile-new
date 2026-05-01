import { apiClient } from '../../lib/api-client';
import type { AuthResponse, LoginRequest } from '../../types/api';
import type { LoginInput, SignupInput } from './schemas';

// Le back renvoie une réponse plate (pas d'objet user imbriqué) — on extrait
// la portion "user" depuis AuthResponse pour le store.
export type AuthUser = Omit<AuthResponse, 'token'>;

export interface UpdateProfileRequest {
  nom: string;
  prenom: string;
  contact: string;
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RegisterRequest {
  nom: string;
  prenom: string;
  contact: string;
  email: string;
  username: string;
  password: string;
  profile?: 'LIVREUR' | 'FOURNISSEUR';
}

export const authApi = {
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const payload: LoginRequest = { username: input.username, password: input.password };
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  /**
   * Auto-inscription. Le back crée un compte avec `statut=EN_ATTENTE_VALIDATION`
   * et `actif=true`. L'utilisateur peut se connecter mais ses actions métier
   * sont bloquées tant qu'un admin ne valide pas son compte.
   * Mirror de `authApi.register` côté web.
   */
  register: async (input: SignupInput): Promise<{ message: string }> => {
    const { confirmPassword: _confirm, ...payload } = input;
    const { data } = await apiClient.post<{ message: string }>('/auth/register', payload);
    return data;
  },

  /**
   * Met à jour les infos du livreur connecté (nom, prénom, contact, email).
   * Renvoie l'utilisateur mis à jour avec le même format que LoginResponse
   * (sans token).
   */
  updateProfile: async (payload: UpdateProfileRequest): Promise<AuthUser> => {
    const { data } = await apiClient.put<AuthUser>('/auth/me', payload);
    return data;
  },

  /**
   * Change le mot de passe du livreur connecté. Le back vérifie que
   * `currentPassword` correspond avant d'appliquer le nouveau.
   */
  changePassword: async (payload: ChangePasswordRequest): Promise<{ message: string }> => {
    const { data } = await apiClient.put<{ message: string }>('/auth/me/password', payload);
    return data;
  },
};
