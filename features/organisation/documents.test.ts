import { montantRecu } from '../reversements/recu';
import { avoir, facture } from './documents.fixture';
import {
  genererHtmlAvoir,
  genererHtmlFacture,
  nomFichierAvoir,
  nomFichierFacture,
  situationFacture,
} from './documents';

const LE = new Date(2026, 9, 14, 9, 5);

describe('noms de fichier (O17)', () => {
  it('Facture_<numero>.pdf et Avoir_<numero>.pdf', () => {
    expect(nomFichierFacture('FAC-2026-000001')).toBe('Facture_FAC-2026-000001.pdf');
    expect(nomFichierAvoir('AV-2026-000001')).toBe('Avoir_AV-2026-000001.pdf');
  });
});

describe('situation de la facture', () => {
  it('situation actuelle à la date d’édition : payé, avoirs, reste dû', () => {
    expect(situationFacture(facture, LE)).toEqual({
      titre: 'Situation au 14/10/2026',
      paye: 600,
      avoirs: 500,
      resteDu: 400,
    });
  });
});

describe('PDF de la facture', () => {
  const html = genererHtmlFacture(facture, { editeLe: LE, logo: 'data:image/png;base64,AAA' });

  it('mentions de l’organisation et logo', () => {
    for (const t of ['Distri CI', 'CI-NCC-1', 'CI-ABJ-2026-B-1', 'Plateau, Abidjan', '0707070707', 'jean@distri.ci'])
      expect(html).toContain(t);
    expect(html).toContain('<img class="logo" src="data:image/png;base64,AAA"');
    expect(genererHtmlFacture(facture, { editeLe: LE, logo: null })).not.toContain('<img');
  });

  it('numéro, date, client, commercial, vente', () => {
    expect(html).toContain('Facture FAC-2026-000001');
    expect(html).toContain('13/10/2026');
    expect(html).toContain('Awa Boutique Awa');
    expect(html).toContain('0712345678');
    expect(html).toContain('Rue 12');
    expect(html).toContain('Yopougon');
    expect(html).toContain('Ali Kone');
    expect(html).toContain('LIV-12');
  });

  it('lignes figées, « Prix TTC », total TTC ; texte échappé', () => {
    expect(html).toContain('Coca &lt;33cl&gt;');
    expect(html).not.toContain('Coca <33cl>');
    expect(html).toContain('Prix TTC');
    expect(html).toContain('Total TTC');
    expect(html).toContain(montantRecu(1500));
  });

  it('situation au jour d’édition : payé, avoirs, reste dû', () => {
    expect(html).toContain('Situation au 14/10/2026');
    expect(html).toContain(`Payé</span><span class="v">${montantRecu(600)}`);
    expect(html).toContain(`Avoirs</span><span class="v">${montantRecu(500)}`);
    expect(html).toContain(`Reste dû</span><span class="v">${montantRecu(400)}`);
    expect(html).toContain('Édité le 14/10/2026 à 09:05');
  });
});

describe('PDF de l’avoir', () => {
  const html = genererHtmlAvoir(avoir, { editeLe: LE, logo: null });

  it('numéro, facture d’origine, motif, lignes au prix de la facture, total', () => {
    expect(html).toContain('Avoir AV-2026-000001');
    expect(html).toContain('FAC-2026-000001');
    expect(html).toContain('Retour produit');
    expect(html).toContain('Distri CI');
    expect(html).toContain('Coca 33cl');
    expect(html).toContain('Prix TTC');
    expect(html).toContain(montantRecu(500));
    expect(html).not.toContain('Situation au');
  });
});
