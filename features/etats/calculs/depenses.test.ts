import type { DepenseResponse } from '../../../types/api';
import { calculerEtatDepenses, libelleCategorieDepense } from './depenses';
import { documentDepenses } from '../document';
import { genererHtmlEtat } from '../html';
import { AUCUN_FILTRE } from '../filtres';

const P = { debut: '2026-10-01', fin: '2026-10-31' };
const dep = (id: string, date: string, categorie: string, montant: number | string, libelle = id): DepenseResponse =>
  ({ id, libelle, categorie, montant, dateDepense: `${date}T10:00:00`, commentaire: null }) as DepenseResponse;

const depenses = [
  dep('d1', '2026-10-05', 'CARBURANT', 5000, 'Essence'),
  dep('d2', '2026-10-02', 'ENTRETIEN', '12000.00', 'Vidange'),
  dep('d3', '2026-10-20', 'CARBURANT', 3000, 'Essence'),
  dep('d4', '2026-09-30', 'CARBURANT', 9999, 'Hors période'),
  dep('d5', '2026-11-01', 'AUTRE', 9999, 'Hors période'),
];

describe('état Dépenses', () => {
  it('liste de la période (plus ancienne d’abord), bloc par catégorie, total', () => {
    const e = calculerEtatDepenses(depenses, P);
    expect(e.depenses.map((d) => d.id)).toEqual(['d2', 'd1', 'd3']);
    expect(e.depenses[0]).toMatchObject({ libelleCategorie: 'Entretien', libelle: 'Vidange', montant: 12000 });
    expect(e.parCategorie).toEqual([
      { categorie: 'ENTRETIEN', libelle: 'Entretien', nb: 1, montant: 12000 },
      { categorie: 'CARBURANT', libelle: 'Carburant', nb: 2, montant: 8000 },
    ]);
    expect(e.totaux).toEqual({ nb: 3, montant: 20000 });
  });

  it('vue équipe : colonne Livreur (proprietaire.nom) en 2e position, absente sinon', () => {
    const ds = [
      { ...dep('d1', '2026-10-05', 'CARBURANT', 1000, 'Plein'), proprietaire: { id: 'u1', nom: 'Awa' } },
      { ...dep('d2', '2026-10-06', 'ENTRETIEN', 500, 'Vidange'), proprietaire: null },
    ] as DepenseResponse[];
    const etat = calculerEtatDepenses(ds, P);
    expect(etat.depenses.map((d) => d.livreur)).toEqual(['Awa', '']);
    const entete = { livreur: 'Équipe', periode: P, editeLe: new Date(2026, 9, 31, 8, 0), filtres: AUCUN_FILTRE };
    const eq = documentDepenses(etat, { ...entete, equipe: true }).sections[0];
    expect(eq.colonnes.map((c) => c.libelle)).toEqual(['Date', 'Livreur', 'Catégorie', 'Libellé', 'Montant']);
    expect(eq.lignes[0]).toEqual(['05/10/2026', 'Awa', 'Carburant', 'Plein', expect.any(String)]);
    expect(eq.totaux).toHaveLength(5);
    const solo = documentDepenses(etat, { ...entete, equipe: false }).sections[0];
    expect(solo.colonnes).toHaveLength(4);
    expect(solo.lignes[0]).toHaveLength(4);
  });

  it('filtre catégorie', () => {
    const e = calculerEtatDepenses(depenses, P, { categorie: 'CARBURANT' });
    expect(e.depenses.map((d) => d.id)).toEqual(['d1', 'd3']);
    expect(e.totaux).toEqual({ nb: 2, montant: 8000 });
  });

  it('libellés des catégories', () => {
    expect(libelleCategorieDepense('ADMINISTRATIF')).toBe('Administratif');
    expect(libelleCategorieDepense('PEAGE')).toBe('PEAGE');
    expect(libelleCategorieDepense(null)).toBe('Autre');
  });

  it('document : sections, totaux, nom de fichier Depenses_Entite_debut_au_fin', () => {
    const entete = { livreur: 'Awa Kone', periode: P, editeLe: new Date(2026, 9, 31, 8, 0), equipe: false };
    const doc = documentDepenses(calculerEtatDepenses(depenses, P), { ...entete, filtres: AUCUN_FILTRE });
    expect(doc.titre).toBe('Dépenses');
    expect(doc.nomFichier).toBe('Depenses_Awa-Kone_2026-10-01_au_2026-10-31');
    expect(doc.sections.map((s) => s.titre)).toEqual(['Dépenses de la période', 'Par catégorie']);
    expect(doc.sections[0].colonnes.map((c) => c.libelle)).toEqual(['Date', 'Catégorie', 'Libellé', 'Montant']);
    expect(doc.sections[0].lignes[0].slice(0, 3)).toEqual(['02/10/2026', 'Entretien', 'Vidange']);
    expect(doc.sections[1].colonnes.map((c) => c.libelle)).toEqual(['Catégorie', 'Nombre', 'Montant']);
    expect(doc.sections[1].totaux?.[1]).toBe('3');

    const filtre = documentDepenses(calculerEtatDepenses(depenses, P, { categorie: 'CARBURANT' }), {
      ...entete,
      filtres: { ...AUCUN_FILTRE, categorie: { id: 'CARBURANT', label: 'Carburant' } },
    });
    expect(filtre.filtres).toEqual([{ libelle: 'Catégorie', valeur: 'Carburant' }]);
    expect(filtre.nomFichier).toBe('Depenses_Carburant_2026-10-01_au_2026-10-31');
    expect(genererHtmlEtat(filtre)).toContain('Catégorie : <b>Carburant</b>');
  });
});
