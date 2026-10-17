import { Linking } from 'react-native';
import { dialog } from './dialog';
import { ouvrirItineraire } from './linking';

jest.mock('./dialog', () => ({ dialog: { choix: jest.fn(), error: jest.fn() } }));

describe('ouvrirItineraire', () => {
  let openURL: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  it('ouvre Google Maps directement, sans choix', () => {
    ouvrirItineraire('5.35,-4.01');
    expect(openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=5.35,-4.01');
    expect(dialog.choix).not.toHaveBeenCalled();
  });

  it('position invalide : rien ne s ouvre', () => {
    ouvrirItineraire('abc');
    expect(dialog.choix).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('ouverture impossible : message d erreur', async () => {
    openURL.mockRejectedValue(new Error('non'));
    ouvrirItineraire('5.35,-4.01');
    await Promise.resolve();
    await Promise.resolve();
    expect(dialog.error).toHaveBeenCalled();
  });
});
