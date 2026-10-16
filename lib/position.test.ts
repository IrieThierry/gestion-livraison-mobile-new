import { lirePosition, urlGoogleMaps, urlWaze } from './position';

describe('lirePosition', () => {
  it('lit "lat,lng" avec espaces tolérés', () => {
    expect(lirePosition('5.35,-4.01')).toEqual({ lat: 5.35, lng: -4.01 });
    expect(lirePosition(' 5.35 , -4.01 ')).toEqual({ lat: 5.35, lng: -4.01 });
    expect(lirePosition('-90,180')).toEqual({ lat: -90, lng: 180 });
  });
  it('renvoie null si vide, mal formée ou hors bornes', () => {
    expect(lirePosition(undefined)).toBeNull();
    expect(lirePosition(null)).toBeNull();
    expect(lirePosition('')).toBeNull();
    expect(lirePosition('abc')).toBeNull();
    expect(lirePosition('5.3')).toBeNull();
    expect(lirePosition('5.3,abc')).toBeNull();
    expect(lirePosition('91,0')).toBeNull();
    expect(lirePosition('-90.1,0')).toBeNull();
    expect(lirePosition('0,181')).toBeNull();
    expect(lirePosition('0,-180.5')).toBeNull();
  });
});

describe('urls itinéraire', () => {
  it('Google Maps', () => {
    expect(urlGoogleMaps({ lat: 5.35, lng: -4.01 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=5.35,-4.01',
    );
  });
  it('Waze', () => {
    expect(urlWaze({ lat: 5.35, lng: -4.01 })).toBe('https://waze.com/ul?ll=5.35,-4.01&navigate=yes');
  });
});
