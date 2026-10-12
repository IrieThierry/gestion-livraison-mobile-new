import { jourDe } from '../etats/calculs/commun';
import { echapperHtml, formatEdition, NOM_APPLICATION } from '../etats/html';
import { assainirSegment } from '../etats/nomFichier';
import { formatJour } from '../etats/periode';
import { formatMontant } from '../../lib/format';
import type { ReversementRecord, UUID } from '../../types/api';

/**
 * Reçu de reversement (même contenu que le web, features/reversements/recu.ts).
 * Fonctions pures : parties, contenu, nom de fichier et HTML ; seul
 * `partagerRecu` (features/reversements/partageRecu.ts) produit le PDF.
 */

export const TITRE_RECU = 'Reçu de reversement';
export const NON_PRECISE = 'Non précisé';
export const MENTION_INFORMATIF =
  'Informatif : reversement noté par le livreur, compté dans aucun total. Seul le reversement enregistré par le fournisseur fait foi.';

const MOIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export type QualitePartie = 'Client' | 'Livreur' | 'Livreur apprenti' | 'Fournisseur';

export interface PartieRecu {
  nom: string;
  qualite: QualitePartie;
}

/** Noms connus de l'écran qui édite le reçu ; null si inconnu. */
export interface AnnuaireRecu {
  client: (id: UUID) => string | null;
  livreur: (id: UUID) => { nom: string; apprenti: boolean } | null;
  fournisseur: (id: UUID) => string | null;
}

/**
 * Bénéficiaire et payeur d'un reversement :
 * - CLIENT : le client (`beneficiaireId`) reçoit, son livreur (`livreurId`) paie ;
 * - FOURNISSEUR : le livreur (`livreurId`) reçoit, le fournisseur
 *   (`beneficiaireId`, qui désigne le fournisseur payeur) paie.
 */
export function partiesReversement(
  r: ReversementRecord,
  annuaire: AnnuaireRecu,
): { beneficiaire: PartieRecu; payeur: PartieRecu } {
  const livreur = r.livreurId ? annuaire.livreur(r.livreurId) : null;
  const partieLivreur: PartieRecu = {
    nom: livreur?.nom || NON_PRECISE,
    qualite: livreur?.apprenti ? 'Livreur apprenti' : 'Livreur',
  };
  if (r.type === 'CLIENT') {
    return {
      beneficiaire: { nom: annuaire.client(r.beneficiaireId) || NON_PRECISE, qualite: 'Client' },
      payeur: partieLivreur,
    };
  }
  return {
    beneficiaire: partieLivreur,
    payeur: { nom: annuaire.fournisseur(r.beneficiaireId) || NON_PRECISE, qualite: 'Fournisseur' },
  };
}

/** `Recu-reversement_<Beneficiaire>_<AAAA-MM-JJ>.pdf` (même assainissement que les états). */
export function nomFichierRecu(beneficiaire: string, dateReversement: string): string {
  const jour = jourDe(dateReversement) ?? '';
  return `Recu-reversement_${assainirSegment(beneficiaire) || 'Beneficiaire'}_${jour}.pdf`;
}

export interface RecuReversement {
  application: string;
  titre: string;
  reference: string;
  /** Date du reversement, `JJ/MM/AAAA`. */
  date: string;
  beneficiaire: PartieRecu;
  payeur: PartieRecu;
  montant: number;
  /** « Octobre 2026 », ou null si la période n'est pas exposée. */
  periode: string | null;
  motif: string | null;
  informatif: boolean;
  /** `JJ/MM/AAAA à HH:mm`. */
  editeLe: string;
  /** Avec l'extension `.pdf`. */
  nomFichier: string;
}

export function recuReversement(
  r: ReversementRecord,
  parties: { beneficiaire: PartieRecu; payeur: PartieRecu },
  editeLe: Date = new Date(),
): RecuReversement {
  const mois = r.periodeMois ? MOIS[r.periodeMois - 1] : undefined;
  return {
    application: NOM_APPLICATION,
    titre: TITRE_RECU,
    reference: r.id,
    date: formatJour(r.dateReversement),
    beneficiaire: parties.beneficiaire,
    payeur: parties.payeur,
    montant: Number(r.montant) || 0,
    periode: mois && r.periodeAnnee ? `${mois} ${r.periodeAnnee}` : null,
    motif: r.commentaire?.trim() || null,
    informatif: !!r.informatif,
    editeLe: formatEdition(editeLe),
    // Bénéficiaire inconnu : « Non-precise », comme le web.
    nomFichier: nomFichierRecu(parties.beneficiaire.nom, r.dateReversement),
  };
}

const partie = (p: PartieRecu) => `${p.nom} (${p.qualite})`;

/** Montant en chiffres, en F CFA : `12 500 F CFA`. */
export function montantRecu(n: number): string {
  return `${formatMontant(n)} F CFA`;
}

/** Champs du reçu, dans l'ordre affiché (période et motif seulement s'ils sont exposés). */
export function champsRecu(recu: RecuReversement): Array<{ libelle: string; valeur: string }> {
  return [
    { libelle: 'Référence', valeur: recu.reference },
    { libelle: 'Date du reversement', valeur: recu.date },
    { libelle: 'Bénéficiaire', valeur: partie(recu.beneficiaire) },
    { libelle: 'Payeur', valeur: partie(recu.payeur) },
    ...(recu.periode ? [{ libelle: 'Période', valeur: recu.periode }] : []),
    ...(recu.motif ? [{ libelle: 'Motif', valeur: recu.motif }] : []),
  ];
}

export const SIGNATURES_RECU = ['Signature du bénéficiaire', 'Signature du payeur'] as const;

const STYLE = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 12px; margin: 0; }
  header { border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-bottom: 16px; }
  .app { color: #059669; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
  h1 { font-size: 20px; margin: 2px 0 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; width: 38%; color: #475569; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
  .montant { margin: 18px 0; border: 2px solid #10b981; border-radius: 6px; padding: 12px; display: flex; justify-content: space-between; align-items: center; }
  .montant .l { color: #475569; text-transform: uppercase; font-size: 11px; font-weight: 700; }
  .montant .v { font-size: 22px; font-weight: 800; }
  .mention { background: #f1f5f9; border-left: 3px solid #64748b; padding: 8px 10px; color: #334155; margin-bottom: 16px; }
  .signatures { display: flex; gap: 24px; margin-top: 28px; }
  .signature { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; height: 110px; padding: 8px; color: #475569; font-size: 11px; }
  footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 6px; color: #64748b; font-size: 10px; }
`;

/** HTML du reçu, converti en PDF par `expo-print`. Tout texte est échappé. */
export function genererHtmlRecu(recu: RecuReversement): string {
  const lignes = champsRecu(recu)
    .map((c) => `<tr><th>${echapperHtml(c.libelle)}</th><td>${echapperHtml(c.valeur)}</td></tr>`)
    .join('');
  const mention = recu.informatif ? `<p class="mention">${echapperHtml(MENTION_INFORMATIF)}</p>` : '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${echapperHtml(`${recu.titre} — ${recu.application}`)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
<div class="app">${echapperHtml(recu.application)}</div>
<h1>${echapperHtml(recu.titre)}</h1>
</header>
<table>${lignes}</table>
<div class="montant"><span class="l">Montant</span><span class="v">${echapperHtml(montantRecu(recu.montant))}</span></div>
${mention}<div class="signatures">${SIGNATURES_RECU.map((s) => `<div class="signature">${echapperHtml(s)}</div>`).join('')}</div>
<footer>Édité le ${echapperHtml(recu.editeLe)}</footer>
</body>
</html>`;
}
