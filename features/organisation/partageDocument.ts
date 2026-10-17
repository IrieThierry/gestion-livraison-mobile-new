import * as FileSystem from 'expo-file-system/legacy';
import { urlPhoto } from '../../lib/api-url';
import { partagerPdf } from '../etats/partage';
import type { AvoirResponse, FactureResponse } from '../../types/api';
import { genererHtmlAvoir, genererHtmlFacture, nomFichierAvoir, nomFichierFacture } from './documents';

/** Type MIME d'une image d'après son extension (le back n'accepte que JPEG et PNG). */
function typeImage(url: string): string {
  return /\.jpe?g(\?|$)/i.test(url) ? 'image/jpeg' : 'image/png';
}

/**
 * Logo de l'organisation embarqué dans le PDF (data URI) : téléchargé dans le
 * cache puis lu en base64, pour ne pas dépendre du réseau au rendu du PDF.
 * Sans logo, ou si le téléchargement échoue, le document sort sans logo.
 */
export async function chargerLogo(logoUrl: string | null | undefined): Promise<string | null> {
  const url = urlPhoto(logoUrl);
  const dossier = FileSystem.cacheDirectory;
  if (!url || !dossier) return null;
  try {
    const destination = `${dossier.endsWith('/') ? dossier : `${dossier}/`}logo-organisation`;
    const r = await FileSystem.downloadAsync(url, destination);
    if (r.status < 200 || r.status >= 300) return null;
    const base64 = await FileSystem.readAsStringAsync(r.uri, { encoding: 'base64' });
    return base64 ? `data:${typeImage(url)};base64,${base64}` : null;
  } catch {
    return null;
  }
}

/** PDF de la facture (`Facture_<numero>.pdf`), puis fenêtre de partage. Renvoie l'URI partagée. */
export async function partagerFacture(f: FactureResponse, editeLe: Date = new Date()): Promise<string> {
  const logo = await chargerLogo(f.organisation?.logoUrl);
  return partagerPdf({
    html: genererHtmlFacture(f, { editeLe, logo }),
    nomFichier: nomFichierFacture(f.numero),
    titre: `Partager la facture ${f.numero}`,
  });
}

/** PDF de l'avoir (`Avoir_<numero>.pdf`), puis fenêtre de partage. Renvoie l'URI partagée. */
export async function partagerAvoir(a: AvoirResponse, editeLe: Date = new Date()): Promise<string> {
  const logo = await chargerLogo(a.organisation?.logoUrl);
  return partagerPdf({
    html: genererHtmlAvoir(a, { editeLe, logo }),
    nomFichier: nomFichierAvoir(a.numero),
    titre: `Partager l’avoir ${a.numero}`,
  });
}
