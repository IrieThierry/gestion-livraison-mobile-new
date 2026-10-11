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
 * de cache connu, le fichier d'origine est gardé.
 */
export async function renommerPdf(uri: string, nomFichier: string): Promise<string> {
  const dossier = FileSystem.cacheDirectory;
  if (!dossier || !nomFichier) return uri;
  const destination = `${dossier.endsWith('/') ? dossier : `${dossier}/`}${nomFichier}.pdf`;
  if (destination === uri) return uri;
  await FileSystem.deleteAsync(destination, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: destination });
  return destination;
}

/**
 * Génère le PDF de l'état sur l'appareil (HTML → PDF avec `expo-print`),
 * le nomme d'après l'état (`Type_Entite_debut_au_fin.pdf`) puis ouvre la
 * fenêtre de partage du téléphone (WhatsApp, e-mail, Fichiers…).
 * Renvoie l'URI du fichier partagé.
 */
export async function partagerPdfEtat(doc: DocumentEtat): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(MESSAGE_PARTAGE_INDISPONIBLE);
  }
  const { uri: brut } = await Print.printToFileAsync({ html: genererHtmlEtat(doc) });
  const uri = await renommerPdf(brut, doc.nomFichier);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Partager l’état « ${doc.titre} »`,
  });
  return uri;
}
