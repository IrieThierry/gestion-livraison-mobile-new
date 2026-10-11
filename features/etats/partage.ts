import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { DocumentEtat } from './document';
import { genererHtmlEtat } from './html';

export const MESSAGE_PARTAGE_INDISPONIBLE = 'Le partage n’est pas disponible sur cet appareil.';

/**
 * Génère le PDF de l'état sur l'appareil (HTML → PDF avec `expo-print`) puis
 * ouvre la fenêtre de partage du téléphone (WhatsApp, e-mail, Fichiers…).
 * Renvoie l'URI du fichier produit.
 */
export async function partagerPdfEtat(doc: DocumentEtat): Promise<string> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(MESSAGE_PARTAGE_INDISPONIBLE);
  }
  const { uri } = await Print.printToFileAsync({ html: genererHtmlEtat(doc) });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Partager l’état « ${doc.titre} »`,
  });
  return uri;
}
