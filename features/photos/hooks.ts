import { useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { photosApi } from './api';
import { useAuthStore } from '../../stores/authStore';
import { clientKeys } from '../clients/keys';
import type { UUID } from '../../types/api';

/**
 * Upload / suppression photo de profil — patche le store auth + AsyncStorage
 * pour que la nouvelle photo soit visible immédiatement dans le header de
 * la page Profil et persistée au prochain démarrage.
 */
export function useUploadMaPhoto() {
  return useMutation({
    mutationFn: ({ uri, name }: { uri: string; name?: string }) =>
      photosApi.uploadMaPhoto(uri, name),
    onSuccess: async (data) => {
      const current = useAuthStore.getState().user;
      if (!current) return;
      const updated = { ...current, photoUrl: data.photoUrl };
      useAuthStore.setState({ user: updated });
      await AsyncStorage.setItem('user', JSON.stringify(updated));
    },
  });
}

export function useSupprimerMaPhoto() {
  return useMutation({
    mutationFn: () => photosApi.supprimerMaPhoto(),
    onSuccess: async () => {
      const current = useAuthStore.getState().user;
      if (!current) return;
      const updated = { ...current, photoUrl: null };
      useAuthStore.setState({ user: updated });
      await AsyncStorage.setItem('user', JSON.stringify(updated));
    },
  });
}

/**
 * Upload / suppression photo client — invalide le cache des clients pour
 * que la nouvelle URL apparaisse partout (liste, fiche, picker livraison).
 */
export function useUploadPhotoClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, uri, name }: { clientId: UUID; uri: string; name?: string }) =>
      photosApi.uploadPhotoClient(clientId, uri, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

export function useSupprimerPhotoClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: UUID) => photosApi.supprimerPhotoClient(clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
