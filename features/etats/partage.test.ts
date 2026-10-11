import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MESSAGE_PARTAGE_INDISPONIBLE, partagerPdfEtat } from './partage';
import { documentVentes } from './document';
import { calculerEtatVentes } from './calculs/ventes';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const printToFile = Print.printToFileAsync as jest.Mock;
const disponible = Sharing.isAvailableAsync as jest.Mock;
const partager = Sharing.shareAsync as jest.Mock;

const periode = { debut: '2026-10-01', fin: '2026-10-31' };
const doc = documentVentes(calculerEtatVentes([], periode), {
  livreur: 'Awa Kone',
  periode,
  editeLe: new Date(2026, 9, 11),
  equipe: false,
});

describe('partagerPdfEtat', () => {
  beforeEach(() => jest.clearAllMocks());

  it('génère le PDF depuis le HTML puis ouvre le partage', async () => {
    disponible.mockResolvedValue(true);
    printToFile.mockResolvedValue({ uri: 'file:///cache/etat.pdf', numberOfPages: 1 });
    partager.mockResolvedValue(undefined);

    await expect(partagerPdfEtat(doc)).resolves.toBe('file:///cache/etat.pdf');

    const html = printToFile.mock.calls[0][0].html as string;
    expect(html).toContain('Ventes / livraisons');
    expect(partager).toHaveBeenCalledWith('file:///cache/etat.pdf', {
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
