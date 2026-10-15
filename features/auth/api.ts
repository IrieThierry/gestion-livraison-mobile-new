import { apiClient } from '../../lib/api-client';
import type { AuthResponse, DemandeReinitialisationResponse, LoginRequest } from '../../types/api';
import type { LoginInput, MotDePasseOublieInput, SignupInput } from './schemas';

// Le back renvoie une réponse plate (pas d'objet user imbriqué) — on extrait
// la portion "user" depuis AuthResponse pour le store. Les tokens (`token`
// et `refreshToken`) sont stockés séparément en SecureStorage par le store.
export type AuthUser = Omit<AuthResponse, 'token' | 'refreshToken'>;

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
  /** Le mobile n'inscrit que des livreurs (le fournisseur s'inscrit sur le portail web). */
  profile: 'LIVREUR';
}

export const authApi = {
  login: async (input: LoginInput): Promise<AuthResponse> => {
    const payload: LoginRequest = { username: input.username, password: input.password };
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  /**
   * Inscription libre d'un livreur : le back crée un compte utilisable tout
   * de suite, avec un abonnement en essai. Réponse 201
   * `{ message: 'Compte créé. Vous pouvez vous connecter.' }`.
   */
  register: async (input: SignupInput): Promise<{ message: string }> => {
    const { confirmPassword: _confirm, ...payload } = input;
    const body: RegisterRequest = { ...payload, profile: 'LIVREUR' };
    const { data } = await apiClient.post<{ message: string }>('/auth/register', body);
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

  /**
   * M1 « Mot de passe oublié » (route publique) : la demande part au
   * responsable du compte. Le back répond toujours 200 avec le même message,
   * que le compte existe ou non.
   */
  motDePasseOublie: async (input: MotDePasseOublieInput): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>('/auth/mot-de-passe-oublie', {
      username: input.username,
      contact: input.contact,
    });
    return data;
  },

  /** M1 : demandes « Mot de passe oublié » en attente visibles par l'appelant (parent, responsable). */
  /** M1 : ignore une demande en attente (elle passe à ANNULEE, le badge disparaît). */
  ignorerDemandeReinitialisation: async (id: string): Promise<{ message: string }> => {
    const { data } = await apiClient.put<{ message: string }>(`/auth/demandes-reinitialisation/${id}/ignorer`);
    return data;
  },

  demandesReinitialisation: async (): Promise<DemandeReinitialisationResponse[]> => {
    const { data } = await apiClient.get<DemandeReinitialisationResponse[]>('/auth/demandes-reinitialisation');
    return Array.isArray(data) ? data : [];
  },
};
