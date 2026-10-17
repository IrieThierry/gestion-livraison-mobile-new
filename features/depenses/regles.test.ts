import {
  CIBLE_MOI,
  auteurDepense,
  cibleDepuisId,
  cibleRetenue,
  depenseModifiable,
  filtreDepenses,
  idCible,
  optionsDepenses,
} from './regles';
import type { DepenseResponse } from '../../types/api';

const principal = { id: 'P', parentId: null };
const apprentis = [
  { id: 'a2', prenom: 'Zoé', nom: 'K', actif: true },
  { id: 'a1', prenom: 'Awa', nom: 'TRAORÉ' },
  { id: 'a3', prenom: 'Inactif', nom: 'X', actif: false },
];
const dep = (over: Partial<DepenseResponse> = {}): DepenseResponse => ({
  id: 'd1',
  libelle: 'Carburant',
  categorie: 'CARBURANT',
  montant: 1500,
  dateDepense: '2026-10-14T00:00:00',
  commentaire: null,
  ...over,
});

describe('S5 : dépenses de l’équipe (règles)', () => {
  it('principal indépendant : Moi, Équipe, puis les apprentis actifs triés', () => {
    expect(optionsDepenses(principal, false, apprentis)).toEqual([
      { id: 'moi', label: 'Moi' },
      { id: 'equipe', label: 'Équipe' },
      { id: 'apprenti:a1', label: 'Awa TRAORÉ' },
      { id: 'apprenti:a2', label: 'Zoé K' },
    ]);
  });

  it('apprenti, membre d’organisation ou déconnecté : pas de sélecteur', () => {
    expect(optionsDepenses({ id: 'A', parentId: 'P' }, false, apprentis)).toEqual([]);
    expect(optionsDepenses(principal, true, apprentis)).toEqual([]);
    expect(optionsDepenses(null, false, apprentis)).toEqual([]);
  });

  it('responsable d’organisation : Moi, Équipe et ses commerciaux (libellé de repli « Commercial »)', () => {
    expect(optionsDepenses(principal, false, [{ id: 'c1', prenom: '', nom: '' }], 'Commercial')).toEqual([
      { id: 'moi', label: 'Moi' },
      { id: 'equipe', label: 'Équipe' },
      { id: 'apprenti:c1', label: 'Commercial' },
    ]);
  });

  it('cible : aller-retour d’identifiant, et repli sur Moi hors options', () => {
    expect(cibleDepuisId(idCible({ type: 'apprenti', id: 'a1' }))).toEqual({ type: 'apprenti', id: 'a1' });
    expect(cibleDepuisId('equipe')).toEqual({ type: 'equipe' });
    expect(cibleDepuisId(null)).toEqual(CIBLE_MOI);
    const options = optionsDepenses(principal, false, apprentis);
    expect(cibleRetenue(options, { type: 'apprenti', id: 'a3' })).toEqual(CIBLE_MOI);
    expect(cibleRetenue([], { type: 'equipe' })).toEqual(CIBLE_MOI);
    expect(cibleRetenue(options, { type: 'equipe' })).toEqual({ type: 'equipe' });
  });

  it('paramètres de GET /depense', () => {
    expect(filtreDepenses(CIBLE_MOI)).toEqual({});
    expect(filtreDepenses({ type: 'equipe' })).toEqual({ equipe: true });
    expect(filtreDepenses({ type: 'apprenti', id: 'a1' })).toEqual({ livreurId: 'a1' });
  });

  it('auteur « par … » seulement quand ce n’est pas le principal ; lecture seule pour les autres', () => {
    const mienne = dep({ proprietaire: { id: 'P', nom: 'Ali K' }, proprietaireUtilisateurId: 'P' });
    const apprentie = dep({ proprietaire: { id: 'a1', nom: 'Awa TRAORÉ' }, proprietaireUtilisateurId: 'a1' });
    const sansNom = dep({ proprietaire: { id: 'a9', nom: null }, proprietaireUtilisateurId: 'a9' });
    expect(auteurDepense(mienne, 'P')).toBeNull();
    expect(auteurDepense(apprentie, 'P')).toBe('par Awa TRAORÉ');
    expect(auteurDepense(sansNom, 'P')).toBeNull();
    expect(depenseModifiable(mienne, 'P')).toBe(true);
    expect(depenseModifiable(apprentie, 'P')).toBe(false);
    expect(depenseModifiable(sansNom, 'P')).toBe(false);
    // Réponse sans auteur (ancien back) : sa propre liste, modifiable.
    expect(depenseModifiable(dep(), 'P')).toBe(true);
  });
});
