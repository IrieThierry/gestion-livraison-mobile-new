import { apiClient } from '../../lib/api-client';
import type { PhotoUploadResponse, UUID } from '../../types/api';

/**
 * Construit le `FormData` multipart pour l'upload depuis un URI local
 * (sortie de expo-image-picker). React Native gère natif le `FormData`
 * avec les objets `{ uri, name, type }`.
 */
function asFormData(uri: string, name = 'photo.jpg'): FormData {
  const fd = new FormData();
  // Détecte le mime à partir de l'extension (JPEG par défaut)
  const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime =
    ext === 'png'
      ? 'image/png'
      : ext === 'gif'
      ? 'image/gif'
      : ext === 'webp'
      ? 'image/webp'
      : 'image/jpeg';
  fd.append('file', {
    uri,
    name,
    type: mime,
  } as unknown as Blob);
  return fd;
}

export const photosApi = {
  /**
   * Upload de la photo de profil de l'utilisateur connecté. Mirror de
   * `photosApi.uploadMaPhoto` côté web — endpoint `POST /utilisateur/me/photo`.
   * La signature back est multipart/form-data avec champ `file`.
   */
  uploadMaPhoto: async (uri: string, name?: string): Promise<PhotoUploadResponse> => {
    const { data } = await apiClient.post<PhotoUploadResponse>(
      '/utilisateur/me/photo',
      asFormData(uri, name),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  /** Supprime la photo de profil de l'utilisateur connecté. */
  supprimerMaPhoto: async (): Promise<void> => {
    await apiClient.delete('/utilisateur/me/photo');
  },

  /** Upload photo client (depuis fiche client). */
  uploadPhotoClient: async (clientId: UUID, uri: string, name?: string): Promise<PhotoUploadResponse> => {
    const { data } = await apiClient.post<PhotoUploadResponse>(
      `/client/${clientId}/photo`,
      asFormData(uri, name),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  supprimerPhotoClient: async (clientId: UUID): Promise<void> => {
    await apiClient.delete(`/client/${clientId}/photo`);
  },

  /** FM3, fournisseur : photo du produit d'une ligne de son catalogue (produit qu'il a créé, 403 sinon). */
  uploadPhotoCatalogue: async (ligneId: UUID, uri: string, name?: string): Promise<PhotoUploadResponse> => {
    const { data } = await apiClient.post<PhotoUploadResponse>(
      `/fournisseur/me/catalogue/${ligneId}/photo`,
      asFormData(uri, name),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  /** Le back répond le texte « Photo supprimée » : il n'est pas lu comme du JSON (comme le web). */
  supprimerPhotoCatalogue: async (ligneId: UUID): Promise<void> => {
    await apiClient.delete(`/fournisseur/me/catalogue/${ligneId}/photo`, { responseType: 'text' });
  },
};
