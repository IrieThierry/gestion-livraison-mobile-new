/** Adresse de l'API (variable `EXPO_PUBLIC_API_URL`, sinon le serveur de recette). */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.112.1.143:8089';

/**
 * URL affichable d'un fichier servi par l'API. Le back renvoie un chemin
 * relatif (`/uploads/produit/…jpg`) : on le préfixe de l'adresse de l'API.
 * Une URL déjà absolue est rendue telle quelle ; vide ou absente → null.
 */
export function urlAbsolue(chemin: string | null | undefined, base: string = API_BASE_URL): string | null {
  const c = chemin?.trim();
  if (!c) return null;
  if (/^(https?:|file:|data:)/i.test(c)) return c;
  const b = base.replace(/\/+$/, '');
  return `${b}${c.startsWith('/') ? '' : '/'}${c}`;
}

/** Hôte local ou réseau privé : une URL de photo émise par le back sur ces hôtes ne sera pas joignable depuis le téléphone. */
const HOTE_LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\])$/i;

/**
 * URL affichable d'une photo (produit, client, utilisateur) servie par l'API.
 *  - chemin relatif (`/uploads/…`) : préfixé de `API_BASE_URL` ;
 *  - URL absolue vers localhost / le réseau local (`http://localhost:8089/uploads/…`) : réécrite sur
 *    `API_BASE_URL` (IP locale ou tunnel https) en gardant chemin et paramètres ;
 *  - autre URL absolue, `file:`, `data:` : inchangée ;
 *  - vide ou absente : null.
 */
export function urlPhoto(photoUrl: string | null | undefined, base: string = API_BASE_URL): string | null {
  const c = photoUrl?.trim();
  if (!c) return null;
  const m = /^https?:\/\/([^/:?#]+|\[[^\]]*\])(?::\d+)?(\/[^#]*)?/i.exec(c);
  if (m && HOTE_LOCAL.test(m[1])) return urlAbsolue(m[2] ?? '/', base);
  return urlAbsolue(c, base);
}
