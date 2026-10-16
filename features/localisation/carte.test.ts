import type { PersonneLocalisable } from '../../types/api';
import { buildHtmlPositions, positionsDuJour } from './carte';

const personne = (over: Partial<PersonneLocalisable> = {}): PersonneLocalisable => ({
  id: 'p1',
  nom: 'Kone',
  prenom: 'Awa',
  photoUrl: null,
  etat: {
    demandeId: 'd1',
    statut: 'ACCEPTEE',
    creeLe: '2026-10-16T14:30:00',
    expireLe: '2026-10-16T14:45:00',
    reponduLe: '2026-10-16T14:32:00',
    position: '5.35,-4.01',
    partageeLe: '2026-10-16T14:32:00',
    repere: null,
  },
  ...over,
});

describe('carte des positions du jour', () => {
  it('un marqueur par position valide (sans état ou position illisible : aucun)', () => {
    const pins = positionsDuJour([
      personne(),
      personne({ id: 'p2', etat: null }),
      personne({ id: 'p3', etat: { ...personne().etat!, position: 'abc' } }),
    ]);
    expect(pins).toEqual([{ id: 'p1', nom: 'Awa Kone', heure: '14:32', lat: 5.35, lng: -4.01 }]);
  });

  it('HTML Leaflet : données échappées et postMessage au clic', () => {
    const html = buildHtmlPositions([personne({ prenom: '</script><b>', nom: 'X' })]);
    expect(html).toContain('leaflet');
    expect(html).toContain('POSITION_TAP');
    expect(html).not.toContain('</script><b>');
    expect(html).toContain('\\u003c/script>');
  });
});
