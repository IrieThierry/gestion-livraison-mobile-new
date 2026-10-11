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
