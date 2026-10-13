import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { chargerLogo, partagerAvoir, partagerFacture } from './partageDocument';
import { avoir, facture } from './documents.fixture';
import { API_BASE_URL } from '../../lib/api-url';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

const printToFile = Print.printToFileAsync as jest.Mock;
const partager = Sharing.shareAsync as jest.Mock;
const telecharger = FileSystem.downloadAsync as jest.Mock;
const lire = FileSystem.readAsStringAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
  (FileSystem.moveAsync as jest.Mock).mockResolvedValue(undefined);
  printToFile.mockResolvedValue({ uri: 'file:///cache/Print/x.pdf', numberOfPages: 1 });
  partager.mockResolvedValue(undefined);
  telecharger.mockResolvedValue({ uri: 'file:///cache/logo-organisation', status: 200 });
  lire.mockResolvedValue('QUJD');
});

describe('partage de la facture et de l’avoir (O17)', () => {
  it('facture : logo embarqué, PDF nommé Facture_<numero>.pdf, fenêtre de partage', async () => {
    await expect(partagerFacture(facture)).resolves.toBe('file:///cache/Facture_FAC-2026-000001.pdf');
    expect(telecharger).toHaveBeenCalledWith(
      `${API_BASE_URL}/uploads/organisation/o1_logo.png`,
      'file:///cache/logo-organisation',
    );
    const html = printToFile.mock.calls[0][0].html as string;
    expect(html).toContain('src="data:image/png;base64,QUJD"');
    expect(html).toContain('Facture FAC-2026-000001');
    expect(partager).toHaveBeenCalledWith('file:///cache/Facture_FAC-2026-000001.pdf', {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Partager la facture FAC-2026-000001',
    });
  });

  it('avoir : PDF nommé Avoir_<numero>.pdf', async () => {
    await expect(partagerAvoir(avoir)).resolves.toBe('file:///cache/Avoir_AV-2026-000001.pdf');
    expect(partager.mock.calls[0][1].dialogTitle).toBe('Partager l’avoir AV-2026-000001');
  });

  it('logo absent ou en échec : document sans logo, partage maintenu', async () => {
    await expect(chargerLogo(null)).resolves.toBeNull();
    telecharger.mockRejectedValueOnce(new Error('réseau'));
    await partagerFacture(facture);
    expect(printToFile.mock.calls[0][0].html).not.toContain('<img');
    expect(partager).toHaveBeenCalled();
    telecharger.mockResolvedValueOnce({ uri: 'file:///cache/logo-organisation', status: 404 });
    await expect(chargerLogo('/uploads/organisation/x.jpg')).resolves.toBeNull();
  });

  it('logo JPEG : type image/jpeg', async () => {
    await expect(chargerLogo('/uploads/organisation/x.JPG')).resolves.toBe('data:image/jpeg;base64,QUJD');
  });
});
