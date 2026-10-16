const SEP_LIGNE = String.fromCharCode(0x2028);
const SEP_PARAGRAPHE = String.fromCharCode(0x2029);

/**
 * JSON sûr à injecter dans un `<script>` inline d'une WebView : échappe `<` (pas de `</script>`
 * ni de `<!--`) et les séparateurs de ligne U+2028 / U+2029. `JSON.parse` redonne la valeur d'origine.
 */
export function jsonPourScript(value: unknown): string {
  return JSON.stringify(value)
    .split('<')
    .join('\\u003c')
    .split(SEP_LIGNE)
    .join('\\u2028')
    .split(SEP_PARAGRAPHE)
    .join('\\u2029');
}
