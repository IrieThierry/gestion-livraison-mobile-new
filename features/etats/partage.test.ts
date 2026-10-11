import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MESSAGE_PARTAGE_INDISPONIBLE, partagerPdfEtat, renommerPdf } from './partage';
import { documentVentes } from './document';
import { calculerEtatVentes } from './calculs/ventes';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
}));

const printToFile = Print.printToFileAsync as jest.Mock;
const disponible = Sharing.isAvailableAsync as jest.Mock;
const partager = Sharing.shareAsync as jest.Mock;
const supprimer = FileSystem.deleteAsync as jest.Mock;
const deplacer = FileSystem.moveAsync as jest.Mock;

const periode = { debut: '2026-10-01', fin: '2026-10-31' };
const doc = documentVentes(calculerEtatVentes([], periode), {
  livreur: 'Awa Kone',
  periode,
  editeLe: new Date(2026, 9, 11),
  equipe: false,
});
const NOM = 'file:///cache/Ventes_Awa-Kone_2026-10-01_au_2026-10-31.pdf';

describe('partagerPdfEtat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supprimer.mockResolvedValue(undefined);
    deplacer.mockResolvedValue(undefined);
  });

  it('génère le PDF, le renomme d’après l’état puis ouvre le partage', async () => {
    disponible.mockResolvedValue(true);
    printToFile.mockResolvedValue({ uri: 'file:///cache/Print/abc.pdf', numberOfPages: 1 });
    partager.mockResolvedValue(undefined);

    await expect(partagerPdfEtat(doc)).resolves.toBe(NOM);

    const html = printToFile.mock.calls[0][0].html as string;
    expect(html).toContain('Ventes / livraisons');
    // Un ancien fichier du même nom est écrasé.
    expect(supprimer).toHaveBeenCalledWith(NOM, { idempotent: true });
    expect(deplacer).toHaveBeenCalledWith({ from: 'file:///cache/Print/abc.pdf', to: NOM });
    expect(supprimer.mock.invocationCallOrder[0]).toBeLessThan(deplacer.mock.invocationCallOrder[0]);
    expect(partager).toHaveBeenCalledWith(NOM, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Partager l’état « Ventes / livraisons »',
    });
  });

  it('partage indisponible : erreur lisible, aucun PDF', async () => {
    disponible.mockResolvedValue(false);
    await expect(partagerPdfEtat(doc)).rejects.toThrow(MESSAGE_PARTAGE_INDISPONIBLE);
    expect(printToFile).not.toHaveBeenCalled();
  });
});

describe('renommerPdf', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renommage en échec : partage du fichier d’origine', async () => {
    disponible.mockResolvedValue(true);
    printToFile.mockResolvedValue({ uri: 'file:///cache/Print/abc.pdf', numberOfPages: 1 });
    supprimer.mockResolvedValue(undefined);
    deplacer.mockRejectedValue(new Error('Stockage plein'));
    partager.mockResolvedValue(undefined);
    await expect(partagerPdfEtat(doc)).resolves.toBe('file:///cache/Print/abc.pdf');
    expect(partager.mock.calls[0][0]).toBe('file:///cache/Print/abc.pdf');
  });

  it('sans nom : fichier d’origine gardé', async () => {
    await expect(renommerPdf('file:///cache/x.pdf', '')).resolves.toBe('file:///cache/x.pdf');
    expect(deplacer).not.toHaveBeenCalled();
  });
});
