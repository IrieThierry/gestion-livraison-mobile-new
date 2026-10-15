import { echapperHtml, formatEdition } from '../etats/html';
import { formatJour } from '../etats/periode';
import { jourIso } from '../../lib/periode';
import { montantRecu } from '../reversements/recu';
import type {
  AvoirResponse,
  ClientDocumentVente,
  CommercialDocumentVente,
  FactureResponse,
  LigneDocumentVente,
  MentionsDocumentVente,
} from '../../types/api';

/**
 * Factures et avoirs d'une organisation (O13, O14, O17), sur le modèle du
 * reçu de reversement : fonctions pures (nom de fichier, situation, HTML) ;
 * `partagerFacture` / `partagerAvoir` (partageDocument.ts) produisent le PDF.
 *
 * Le PDF imprime le document figé (mentions, client, commercial, lignes
 * nettes facturées, total TTC, « Prix TTC ») et, pour une facture, la
 * situation actuelle « Situation au <date> » : payé, avoirs, reste dû.
 */

export const nomFichierFacture = (numero: string): string => `Facture_${numero}.pdf`;
export const nomFichierAvoir = (numero: string): string => `Avoir_${numero}.pdf`;

export interface SituationFacture {
  titre: string;
  paye: number;
  avoirs: number;
  resteDu: number;
}

/** Situation actuelle de la facture (calculée par le back à la lecture), datée du jour d'édition. */
export function situationFacture(
  f: Pick<FactureResponse, 'montantPaye' | 'totalAvoirs' | 'resteDu'>,
  le: Date = new Date(),
): SituationFacture {
  return {
    titre: `Situation au ${formatJour(jourIso(le))}`,
    paye: Number(f.montantPaye) || 0,
    avoirs: Number(f.totalAvoirs) || 0,
    resteDu: Number(f.resteDu) || 0,
  };
}

export interface OptionsDocument {
  editeLe?: Date;
  /** Logo de l'organisation (data URI ou URL), null sans logo. */
  logo?: string | null;
}

const STYLE = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 11.5px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #047857; padding-bottom: 10px; margin-bottom: 14px; }
  .emetteur { display: flex; gap: 10px; align-items: flex-start; }
  .logo { max-width: 90px; max-height: 70px; object-fit: contain; }
  .raison { font-size: 15px; font-weight: 800; }
  .mentions { color: #334155; line-height: 1.45; }
  .doc { text-align: right; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #334155; line-height: 1.5; }
  .parties { display: flex; gap: 16px; margin-bottom: 14px; }
  .partie { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; line-height: 1.45; }
  .partie .t { color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 700; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 6px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; }
  .d { text-align: right; white-space: nowrap; }
  tr.total td { font-weight: 800; border-top: 2px solid #047857; border-bottom: none; }
  .mention { color: #475569; margin-top: 6px; }
  .situation { margin-top: 18px; border: 2px solid #047857; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid; break-inside: avoid; }
  .situation h2 { font-size: 13px; margin: 0 0 6px; }
  .situation .l { display: flex; justify-content: space-between; padding: 2px 0; }
  .situation .v { font-weight: 800; }
  footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 6px; color: #64748b; font-size: 10px; }
`;

const nom = (prenom: string | null | undefined, nomFamille: string | null | undefined) =>
  [prenom, nomFamille].map((s) => s?.trim()).filter(Boolean).join(' ');

function htmlEmetteur(o: MentionsDocumentVente, logo: string | null | undefined): string {
  const mentions = [
    o.ncc ? `NCC : ${o.ncc}` : null,
    o.rccm ? `RCCM : ${o.rccm}` : null,
    o.adresse,
    o.telephone ? `Tél. : ${o.telephone}` : null,
    o.email,
  ]
    .filter((m): m is string => !!m)
    .map((m) => `<div>${echapperHtml(m)}</div>`)
    .join('');
  const img = logo ? `<img class="logo" src="${echapperHtml(logo)}" alt="" />` : '';
  return `<div class="emetteur">${img}<div><div class="raison">${echapperHtml(o.raisonSociale)}</div><div class="mentions">${mentions}</div></div></div>`;
}

function htmlParties(c: ClientDocumentVente, k: CommercialDocumentVente): string {
  const lignesClient = [nom(c.prenom, c.nom) || 'Client', c.contact, c.adresse, c.quartier]
    .filter((m): m is string => !!m)
    .map((m) => `<div>${echapperHtml(m)}</div>`)
    .join('');
  const lignesCommercial = [nom(k.prenom, k.nom), k.contact]
    .filter((m): m is string => !!m)
    .map((m) => `<div>${echapperHtml(m)}</div>`)
    .join('');
  return `<div class="parties"><div class="partie"><div class="t">Client</div>${lignesClient}</div><div class="partie"><div class="t">Commercial</div>${lignesCommercial}</div></div>`;
}

function htmlLignes(lignes: LigneDocumentVente[], total: number, mentionPrix: string): string {
  const corps = lignes
    .map(
      (l) =>
        `<tr><td>${echapperHtml(l.designation)}</td><td class="d">${echapperHtml(l.quantite)}</td><td class="d">${echapperHtml(
          montantRecu(Number(l.prixUnitaireTtc) || 0),
        )}</td><td class="d">${echapperHtml(montantRecu(Number(l.montantTtc) || 0))}</td></tr>`,
    )
    .join('');
  return `<table><thead><tr><th>Désignation</th><th class="d">Quantité</th><th class="d">Prix unitaire TTC</th><th class="d">Montant TTC</th></tr></thead><tbody>${corps}<tr class="total"><td colspan="3">Total TTC</td><td class="d">${echapperHtml(
    montantRecu(Number(total) || 0),
  )}</td></tr></tbody></table><p class="mention">${echapperHtml(mentionPrix || 'Prix TTC')}</p>`;
}

function page(titre: string, corps: string, editeLe: Date): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${echapperHtml(titre)}</title>
<style>${STYLE}</style>
</head>
<body>
${corps}
<footer>Édité le ${echapperHtml(formatEdition(editeLe))}</footer>
</body>
</html>`;
}

/** HTML de la facture (converti en PDF par `expo-print`). Tout texte est échappé. */
export function genererHtmlFacture(f: FactureResponse, opts: OptionsDocument = {}): string {
  const editeLe = opts.editeLe ?? new Date();
  const titre = `Facture ${f.numero}`;
  const s = situationFacture(f, editeLe);
  const meta = [`Date : ${formatJour(f.date)}`, f.livraisonReference ? `Vente : ${f.livraisonReference}` : null]
    .filter((m): m is string => !!m)
    .map((m) => `<div>${echapperHtml(m)}</div>`)
    .join('');
  const ligneSituation = (libelle: string, v: number) =>
    `<div class="l"><span>${echapperHtml(libelle)}</span><span class="v">${echapperHtml(montantRecu(v))}</span></div>`;
  const corps = `<header>${htmlEmetteur(f.organisation, opts.logo)}<div class="doc"><h1>${echapperHtml(titre)}</h1><div class="meta">${meta}</div></div></header>
${htmlParties(f.client, f.commercial)}
${htmlLignes(f.lignes, f.totalTtc, f.mentionPrix)}
<div class="situation"><h2>${echapperHtml(s.titre)}</h2>${ligneSituation('Payé', s.paye)}${ligneSituation('Avoirs', s.avoirs)}${ligneSituation('Reste dû', s.resteDu)}</div>`;
  return page(titre, corps, editeLe);
}

/** HTML de l'avoir (retour produit sur une vente facturée, au prix de la facture). */
export function genererHtmlAvoir(a: AvoirResponse, opts: OptionsDocument = {}): string {
  const editeLe = opts.editeLe ?? new Date();
  const titre = `Avoir ${a.numero}`;
  const meta = [`Date : ${formatJour(a.date)}`, `Facture d’origine : ${a.factureNumero}`, `Motif : ${a.motif}`]
    .map((m) => `<div>${echapperHtml(m)}</div>`)
    .join('');
  const corps = `<header>${htmlEmetteur(a.organisation, opts.logo)}<div class="doc"><h1>${echapperHtml(titre)}</h1><div class="meta">${meta}</div></div></header>
${htmlParties(a.client, a.commercial)}
${htmlLignes(a.lignes, a.totalTtc, a.mentionPrix)}`;
  return page(titre, corps, editeLe);
}
