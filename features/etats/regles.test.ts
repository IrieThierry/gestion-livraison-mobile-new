import {
  afficheFiltreLivreur,
  choixAutorise,
  choixDepuisId,
  cibleLecture,
  famillesVisibles,
  idChoix,
  libelleChoix,
  optionsLivreur,
  peutVoirFamille,
} from './acces';
import { erreurPeriode, formatJour, libellePeriode, periodeParDefaut, periodeRaccourci } from './periode';

const principal = { id: 'p', prenom: 'Awa', nom: 'Kone', parentId: null };
const apprenti = { id: 'a1', prenom: 'Moussa', nom: 'Sy', parentId: 'p' };
const apprentis = [
  { id: 'a1', prenom: 'Moussa', nom: 'Sy' },
  { id: 'a2', prenom: 'Fanta', nom: 'Ba' },
];

describe('périodes des états', () => {
  const now = new Date(2026, 9, 11, 15, 0); // 11 octobre 2026

  it('par défaut : le mois en cours, du 1er à aujourd’hui', () => {
    expect(periodeParDefaut(now)).toEqual({ debut: '2026-10-01', fin: '2026-10-11' });
  });

  it('raccourcis : mois précédent et 30 jours', () => {
    expect(periodeRaccourci('moisPrecedent', now)).toEqual({ debut: '2026-09-01', fin: '2026-09-30' });
    expect(periodeRaccourci('30j', now)).toEqual({ debut: '2026-09-12', fin: '2026-10-11' });
    expect(periodeRaccourci('moisPrecedent', new Date(2026, 0, 15))).toEqual({
      debut: '2025-12-01',
      fin: '2025-12-31',
    });
  });

  it('erreurs de saisie', () => {
    expect(erreurPeriode({ debut: null, fin: '2026-10-11' })).toBe(
      'Choisissez une date de début et une date de fin.',
    );
    expect(erreurPeriode({ debut: '2026-10-12', fin: '2026-10-11' })).toBe(
      'La date de début doit précéder la date de fin.',
    );
    expect(erreurPeriode({ debut: '2026-10-11', fin: '2026-10-11' })).toBeNull();
  });

  it('libellés', () => {
    expect(formatJour('2026-10-05T14:30:00')).toBe('05/10/2026');
    expect(libellePeriode({ debut: '2026-10-01', fin: '2026-10-11' })).toBe('du 01/10/2026 au 11/10/2026');
  });
});

describe('accès aux états', () => {
  it('l’apprenti n’a pas la carte « Fournisseurs et versements »', () => {
    expect(famillesVisibles(principal).map((f) => f.key)).toEqual([
      'ventes',
      'encaissements',
      'stock',
      'fournisseurs',
      'depenses',
    ]);
    expect(famillesVisibles(apprenti).map((f) => f.key)).toEqual(['ventes', 'encaissements', 'stock', 'depenses']);
    expect(peutVoirFamille(apprenti, 'depenses')).toBe(true);
    expect(peutVoirFamille(apprenti, 'fournisseurs')).toBe(false);
    expect(famillesVisibles(null)).toEqual([]);
  });

  it('options du livreur : principal → moi, équipe, apprentis ; apprenti → moi', () => {
    expect(optionsLivreur(principal, apprentis)).toEqual([
      { id: 'moi', label: 'Moi' },
      { id: 'equipe', label: 'Équipe (moi et mes apprentis)' },
      { id: 'apprenti:a1', label: 'Moussa Sy' },
      { id: 'apprenti:a2', label: 'Fanta Ba' },
    ]);
    expect(optionsLivreur(apprenti, [])).toEqual([{ id: 'moi', label: 'Moi' }]);
  });

  it('filtre livreur : principal hors fournisseurs seulement', () => {
    expect(afficheFiltreLivreur(principal, 'ventes')).toBe(true);
    expect(afficheFiltreLivreur(principal, 'fournisseurs')).toBe(false);
    // Dépenses : la route ne renvoie que celles de l'appelant.
    expect(afficheFiltreLivreur(principal, 'depenses')).toBe(false);
    expect(afficheFiltreLivreur(apprenti, 'ventes')).toBe(false);
  });

  it('identifiants d’option aller-retour', () => {
    expect(choixDepuisId(idChoix({ type: 'apprenti', id: 'a2' }))).toEqual({ type: 'apprenti', id: 'a2' });
    expect(choixDepuisId('equipe')).toEqual({ type: 'equipe' });
    expect(choixDepuisId(null)).toEqual({ type: 'moi' });
  });

  it('choix autorisé : apprenti limité à lui-même, principal à SES apprentis', () => {
    const ids = apprentis.map((a) => a.id);
    expect(choixAutorise(apprenti, { type: 'equipe' }, [], 'ventes')).toEqual({ type: 'moi' });
    expect(choixAutorise(apprenti, { type: 'apprenti', id: 'a2' }, [], 'stock')).toEqual({ type: 'moi' });
    expect(choixAutorise(principal, { type: 'apprenti', id: 'x' }, ids, 'ventes')).toEqual({ type: 'moi' });
    expect(choixAutorise(principal, { type: 'apprenti', id: 'a1' }, ids, 'ventes')).toEqual({
      type: 'apprenti',
      id: 'a1',
    });
    expect(choixAutorise(principal, { type: 'equipe' }, ids, 'fournisseurs')).toEqual({ type: 'moi' });
    expect(choixAutorise(principal, { type: 'apprenti', id: 'a1' }, ids, 'depenses')).toEqual({ type: 'moi' });
  });

  it('cible des lectures et libellé de l’en-tête', () => {
    expect(cibleLecture(principal, { type: 'equipe' })).toEqual({ mode: 'equipe', parentId: 'p' });
    expect(cibleLecture(principal, { type: 'apprenti', id: 'a1' })).toEqual({ mode: 'livreur', livreurId: 'a1' });
    expect(cibleLecture(apprenti, { type: 'moi' })).toEqual({ mode: 'livreur', livreurId: 'a1' });
    expect(libelleChoix(principal, { type: 'moi' }, apprentis)).toBe('Awa Kone');
    expect(libelleChoix(principal, { type: 'equipe' }, apprentis)).toBe('Équipe de Awa Kone');
    expect(libelleChoix(principal, { type: 'apprenti', id: 'a2' }, apprentis)).toBe('Fanta Ba');
  });
});
