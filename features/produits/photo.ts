/**
 * FM3 : contrôle d'une photo de produit avant l'envoi, mêmes règles que le web
 * (`features/photos/produit.ts`, G5) : JPEG ou PNG, 10 Mo au plus. Sur le
 * téléphone, le format se lit sur l'extension du fichier choisi ; la taille,
 * quand le système la donne.
 */
export const TAILLE_MAX_PHOTO = 10 * 1024 * 1024;
export const MESSAGE_FORMAT_PHOTO = 'Format non supporté : JPEG ou PNG uniquement.';
export const MESSAGE_TAILLE_PHOTO = 'Fichier trop volumineux (10 Mo maximum).';
export const MESSAGE_PHOTO_NON_ENVOYEE =
  "Produit ajouté, mais la photo n'a pas pu être envoyée : ajoute-la depuis Modifier.";
export const MESSAGE_PHOTO_ADMIN = "Photo gérée par l'administrateur.";

/** Le message à afficher, ou null si la photo peut partir. */
export function verifierPhotoProduit(photo: { uri?: string; name: string; fileSize?: number | null }): string | null {
  // Le fichier réellement envoyé (uri) fait foi : l'éditeur du téléphone le réenregistre en JPEG.
  const extension = (chemin: string | undefined) => chemin?.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  const ok = (e: string) => ['jpg', 'jpeg', 'png'].includes(e);
  if (!ok(extension(photo.uri)) && !ok(extension(photo.name))) return MESSAGE_FORMAT_PHOTO;
  if (photo.fileSize != null && photo.fileSize > TAILLE_MAX_PHOTO) return MESSAGE_TAILLE_PHOTO;
  return null;
}
