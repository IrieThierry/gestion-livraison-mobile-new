import type { DocumentEtat, SectionEtat } from './document';
import { libellePeriode } from './periode';

export const NOM_APPLICATION = 'Gestion Livraison';

/** Échappe les caractères spéciaux HTML d'un texte (désignations, noms, commentaires). */
export function echapperHtml(texte: unknown): string {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Date et heure d'édition : `11/10/2026 à 14:05`. */
export function formatEdition(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STYLE = `
  @page { size: A4; margin: 14mm 12mm 16mm 12mm;
    @bottom-right { content: "Page " counter(page) " / " counter(pages); font-size: 9px; color: #64748b; } }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
  header { border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-bottom: 12px; }
  .app { color: #059669; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
  h1 { font-size: 18px; margin: 2px 0 6px; }
  .meta { color: #334155; line-height: 1.5; }
  .meta b { color: #0f172a; }
  .syntheses { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
  .synthese { border: 1px solid #e2e8f0; border-left: 3px solid #10b981; border-radius: 4px; padding: 5px 8px; min-width: 110px; }
  .synthese .l { color: #64748b; font-size: 9px; text-transform: uppercase; }
  .synthese .v { font-weight: 800; font-size: 13px; }
  h2 { font-size: 13px; margin: 16px 0 4px; }
  .note { color: #64748b; font-size: 9.5px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr { page-break-inside: avoid; }
  th { background: #f1f5f9; text-align: left; font-size: 9.5px; text-transform: uppercase; color: #475569; padding: 5px 6px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .d { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 800; background: #ecfdf5; border-top: 2px solid #10b981; }
  .vide { color: #64748b; font-style: italic; padding: 6px 0; }
  footer { margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 6px; color: #64748b; font-size: 9px; }
`;

function cellule(balise: 'td' | 'th', texte: string, droite?: boolean): string {
  return `<${balise}${droite ? ' class="d"' : ''}>${echapperHtml(texte)}</${balise}>`;
}

function htmlSection(s: SectionEtat): string {
  const titre = `<h2>${echapperHtml(s.titre)}</h2>`;
  const note = s.note ? `<p class="note">${echapperHtml(s.note)}</p>` : '';
  if (s.lignes.length === 0) {
    return `<section>${titre}${note}<p class="vide">${echapperHtml(s.vide)}</p></section>`;
  }
  const entete = `<thead><tr>${s.colonnes.map((c) => cellule('th', c.libelle, c.droite)).join('')}</tr></thead>`;
  const corps = `<tbody>${s.lignes
    .map((l) => `<tr>${l.map((v, i) => cellule('td', v, s.colonnes[i]?.droite)).join('')}</tr>`)
    .join('')}</tbody>`;
  const pied = s.totaux
    ? `<tfoot><tr>${s.totaux.map((v, i) => cellule('td', v, s.colonnes[i]?.droite)).join('')}</tr></tfoot>`
    : '';
  return `<section>${titre}${note}<table>${entete}${corps}${pied}</table></section>`;
}

/**
 * HTML complet d'un état, converti en PDF par `expo-print` : en-tête (nom de
 * l'application, livreur, période, date d'édition), synthèse, tableaux avec
 * totaux en pied, pied de page. Tout texte est échappé.
 */
export function genererHtmlEtat(doc: DocumentEtat): string {
  const edition = formatEdition(doc.editeLe);
  const syntheses = doc.syntheses.length
    ? `<div class="syntheses">${doc.syntheses
        .map(
          (s) =>
            `<div class="synthese"><div class="l">${echapperHtml(s.libelle)}</div><div class="v">${echapperHtml(s.valeur)}</div></div>`,
        )
        .join('')}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${echapperHtml(`${doc.titre} — ${NOM_APPLICATION}`)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
<div class="app">${echapperHtml(NOM_APPLICATION)}</div>
<h1>${echapperHtml(doc.titre)}</h1>
<div class="meta">
<div>Livreur : <b>${echapperHtml(doc.livreur)}</b></div>
${(doc.filtres ?? []).map((f) => `<div>${echapperHtml(f.libelle)} : <b>${echapperHtml(f.valeur)}</b></div>\n`).join('')}<div>Période : <b>${echapperHtml(libellePeriode(doc.periode))}</b></div>
<div>Édité le ${echapperHtml(edition)}</div>
</div>
${syntheses}
</header>
${doc.sections.map(htmlSection).join('\n')}
<footer>${echapperHtml(`${NOM_APPLICATION} · ${doc.titre} · ${doc.livreur} · édité le ${edition}`)}</footer>
</body>
</html>`;
}
