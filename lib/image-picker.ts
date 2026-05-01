import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

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
 * refusées (Alert affichée dans ce dernier cas).
 */
export async function pickImage(opts?: {
  /** Aspect ratio à imposer dans l'éditeur (par ex. [1, 1] pour avatar carré) */
  aspect?: [number, number];
}): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Photo',
      'Choisis comment ajouter ta photo',
      [
        {
          text: 'Prendre une photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert(
                'Permission refusée',
                "L'app a besoin d'accéder à l'appareil photo. Active la permission dans les réglages.",
              );
              resolve(null);
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: opts?.aspect,
              quality: 0.7,
            });
            resolve(toPickedImage(result));
          },
        },
        {
          text: 'Choisir dans la galerie',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert(
                'Permission refusée',
                "L'app a besoin d'accéder à ta galerie. Active la permission dans les réglages.",
              );
              resolve(null);
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: opts?.aspect,
              quality: 0.7,
            });
            resolve(toPickedImage(result));
          },
        },
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
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
