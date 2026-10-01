import * as ImagePicker from 'expo-image-picker';
import { useDialogStore } from '../stores/dialogStore';
import { dialog } from './dialog';

export interface PickedImage {
  uri: string;
  name: string;
  width: number;
  height: number;
}

/**
 * Prompte l'utilisateur pour choisir entre prendre une photo ou en
 * sélectionner une dans la galerie, gère les permissions, et renvoie
 * l'URI local + le nom de fichier (utile pour FormData).
 *
 * Renvoie `null` si l'utilisateur annule ou si les permissions sont
 * refusées (dialog d'info affichée dans ce dernier cas).
 */
export async function pickImage(opts?: {
  /** Aspect ratio à imposer dans l'éditeur (par ex. [1, 1] pour avatar carré) */
  aspect?: [number, number];
}): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val: PickedImage | null) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    useDialogStore.getState().show({
      variant: 'info',
      title: 'Photo',
      message: 'Choisis comment ajouter ta photo',
      actions: [
        {
          label: 'Annuler',
          style: 'secondary',
          onPress: () => safeResolve(null),
        },
        {
          label: 'Galerie',
          style: 'secondary',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              dialog.info(
                'Permission refusée',
                "L'app a besoin d'accéder à ta galerie. Active la permission dans les réglages.",
              );
              safeResolve(null);
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: opts?.aspect,
              quality: 0.7,
            });
            safeResolve(toPickedImage(result));
          },
        },
        {
          label: 'Prendre photo',
          style: 'primary',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              dialog.info(
                'Permission refusée',
                "L'app a besoin d'accéder à l'appareil photo. Active la permission dans les réglages.",
              );
              safeResolve(null);
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: opts?.aspect,
              quality: 0.7,
            });
            safeResolve(toPickedImage(result));
          },
        },
      ],
    });
  });
}

function toPickedImage(
  result: ImagePicker.ImagePickerResult,
): PickedImage | null {
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  // Le nom de fichier est parfois exposé via `asset.fileName`, sinon on
  // construit à partir de l'URI ou on utilise un défaut.
  const fileName =
    asset.fileName ??
    asset.uri.split('/').pop() ??
    `photo-${Date.now()}.jpg`;
  return {
    uri: asset.uri,
    name: fileName,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
  };
}
