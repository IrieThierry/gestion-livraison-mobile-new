import { Linking } from 'react-native';
import { dialog } from './dialog';
import { ouvrirItineraire } from './linking';

jest.mock('./dialog', () => ({ dialog: { choix: jest.fn(), error: jest.fn() } }));

const choix = dialog.choix as jest.Mock;

describe('ouvrirItineraire', () => {
  let openURL: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  it('propose Google Maps et Waze, Waze ouvre le lien Waze', () => {
    ouvrirItineraire('5.35,-4.01');
    const options = choix.mock.calls[0][0].options as Array<{ label: string; onPress: () => void }>;
    expect(options.map((o) => o.label)).toEqual(['Google Maps', 'Waze']);
    options[1].onPress();
    expect(openURL).toHaveBeenCalledWith('https://waze.com/ul?ll=5.35,-4.01&navigate=yes');
  });

  it('Google Maps ouvre le lien Google Maps', () => {
    ouvrirItineraire('5.35,-4.01');
    choix.mock.calls[0][0].options[0].onPress();
    expect(openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=5.35,-4.01');
  });

  it('position invalide : rien ne s ouvre', () => {
    ouvrirItineraire('abc');
    expect(choix).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
  });
});
