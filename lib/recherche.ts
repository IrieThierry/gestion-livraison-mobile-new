/**
 * Recherche texte partagée par les écrans (listes, pickers) : insensible à la
 * casse et aux accents, multi-mots (chaque mot saisi doit apparaître dans au
 * moins un des champs de l'élément).
 */

/** Minuscules, sans accents, espaces normalisés. */
export function normaliserRecherche(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type ChampRecherche = string | number | null | undefined;

/** Vrai si chaque mot de `requete` apparaît dans l'un des `champs`. Requête vide → vrai. */
export function correspondRecherche(requete: string, champs: ChampRecherche[]): boolean {
  const mots = normaliserRecherche(requete).split(' ').filter(Boolean);
  if (mots.length === 0) return true;
  const texte = champs.map(normaliserRecherche).filter(Boolean).join(' ');
  return mots.every((m) => texte.includes(m));
}

/** Filtre `items` sur `requete` ; l'ordre d'origine est conservé. */
export function filtrerRecherche<T>(
  items: readonly T[],
  requete: string,
  champs: (item: T) => ChampRecherche[],
): T[] {
  if (!normaliserRecherche(requete)) return [...items];
  return items.filter((it) => correspondRecherche(requete, champs(it)));
}

/** Texte unique affiché quand une recherche ne renvoie rien. */
export const AUCUN_RESULTAT = 'Aucun résultat';
