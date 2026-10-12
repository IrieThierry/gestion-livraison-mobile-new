import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { DocumentEtat } from './document';
import { genererHtmlEtat } from './html';

export const MESSAGE_PARTAGE_INDISPONIBLE = 'Le partage n’est pas disponible sur cet appareil.';

/**
 * Renomme le PDF produit par `expo-print` (nom aléatoire) en
 * `<cache>/<nomFichier>.pdf`, pour que WhatsApp, l'e-mail ou les Fichiers
 * montrent un nom parlant. Un fichier du même nom est écrasé. Sans dossier
 * de cache connu, ou si le renommage échoue (stockage plein, droits…), le
 * fichier d'origine est gardé : le partage ne doit pas échouer pour un nom.
 */
export async function renommerPdf(uri: string, nomFichier: string): Promise<string> {
  const dossier = FileSystem.cacheDirectory;
  if (!dossier || !nomFichier) return uri;
  const destination = `${dossier.endsWith('/') ? dossier : `${dossier}/`}${nomFichier}.pdf`;
  if (destination === uri) return uri;
  try {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: destination });
    return destination;
  } catch {
    return uri;
  }
}

/**
 * Génère un PDF sur l'appareil (HTML → PDF avec `expo-print`), le nomme
 * `<nomFichier>.pdf` (extension ajoutée si absente) puis ouvre la fenêtre de
 * partage du téléphone (WhatsApp, e-mail, Fichiers…). Commun aux états et
 * au reçu de reversement. Renvoie l'URI du fichier partagé.
 */
export async function partagerPdf(p: { html: string; nomFichier: string; titre: string }): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(MESSAGE_PARTAGE_INDISPONIBLE);
  }
  const { uri: brut } = await Print.printToFileAsync({ html: p.html });
  const uri = await renommerPdf(brut, p.nomFichier.replace(/\.pdf$/i, ''));
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: p.titre,
  });
  return uri;
}

/**
 * PDF d'un état, nommé d'après l'état (`Type_Entite_debut_au_fin.pdf`),
 * puis fenêtre de partage. Renvoie l'URI du fichier partagé.
 */
export function partagerPdfEtat(doc: DocumentEtat): Promise<string> {
  return partagerPdf({
    html: genererHtmlEtat(doc),
    nomFichier: doc.nomFichier,
    titre: `Partager l’état « ${doc.titre} »`,
  });
}
