import { partagerPdf } from '../etats/partage';
import { genererHtmlRecu, type RecuReversement } from './recu';

/**
 * PDF du reçu de reversement (`Recu-reversement_<Beneficiaire>_<AAAA-MM-JJ>.pdf`)
 * puis fenêtre de partage du téléphone. Renvoie l'URI du fichier partagé.
 */
export function partagerRecu(recu: RecuReversement): Promise<string> {
  return partagerPdf({
    html: genererHtmlRecu(recu),
    nomFichier: recu.nomFichier,
    titre: 'Partager le reçu de reversement',
  });
}
