/**
 * FM3 : contrôle d'une photo de produit avant l'envoi, mêmes règles que le web
 * (`features/photos/produit.ts`, G5) : JPEG ou PNG, 10 Mo au plus. Sur le
 * téléphone, le type réel vient du fichier choisi (`mimeType` du sélecteur),
 * sinon de l'extension du fichier réellement envoyé (uri), enfin du nom ; la
 * taille, quand le système la donne.
 */
export const TAILLE_MAX_PHOTO = 10 * 1024 * 1024;
export const MESSAGE_FORMAT_PHOTO = 'Format non supporté : JPEG ou PNG uniquement.';
export const MESSAGE_TAILLE_PHOTO = 'Fichier trop volumineux (10 Mo maximum).';
export const MESSAGE_PHOTO_NON_ENVOYEE =
  "Produit ajouté, mais la photo n'a pas pu être envoyée : ajoute-la depuis Modifier.";
export const MESSAGE_PHOTO_ADMIN = "Photo gérée par l'administrateur.";

export interface PhotoChoisie {
  uri?: string;
  name: string;
  /** Type réel donné par le sélecteur (ex. `image/jpeg`), s'il le connaît. */
  mimeType?: string | null;
  fileSize?: number | null;
}

type TypePhoto = 'jpeg' | 'png';

const extension = (chemin: string | undefined) =>
  chemin?.split(/[?#]/)[0].split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';

const typeDeExtension = (e: string): TypePhoto | null => (e === 'jpg' || e === 'jpeg' ? 'jpeg' : e === 'png' ? 'png' : null);

/** Type réel : `mimeType` d'abord ; sans lui, l'extension de l'uri, puis celle du nom. */
function typeReel(photo: PhotoChoisie): TypePhoto | null {
  const mime = photo.mimeType?.trim().toLowerCase();
  if (mime) return mime === 'image/jpeg' || mime === 'image/jpg' ? 'jpeg' : mime === 'image/png' ? 'png' : null;
  return typeDeExtension(extension(photo.uri)) ?? typeDeExtension(extension(photo.name));
}

/**
 * Photo prête à l'envoi : son nom porte l'extension du type réel (le type déclaré
 * dans l'envoi en découle), ou le message à afficher (format ou taille refusés).
 */
export function lirePhotoProduit(photo: PhotoChoisie): { ok: true; name: string } | { ok: false; erreur: string } {
  const type = typeReel(photo);
  if (!type) return { ok: false, erreur: MESSAGE_FORMAT_PHOTO };
  if (photo.fileSize != null && photo.fileSize > TAILLE_MAX_PHOTO) return { ok: false, erreur: MESSAGE_TAILLE_PHOTO };
  const base = photo.name.replace(/\.[^./]*$/, '') || 'photo';
  return { ok: true, name: `${base}.${type === 'jpeg' ? 'jpg' : 'png'}` };
}

/** Le message à afficher, ou null si la photo peut partir. */
export function verifierPhotoProduit(photo: PhotoChoisie): string | null {
  const lu = lirePhotoProduit(photo);
  return lu.ok ? null : lu.erreur;
}
