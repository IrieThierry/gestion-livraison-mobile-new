import {
  construireMiseAZero,
  libelleQuantiteMouvement,
  libelleTypeMouvement,
  MESSAGES_MISE_A_ZERO,
  MOTIFS_AJUSTEMENT,
  peutMettreAZero,
} from './regles';
import type { TypeMouvementStock } from '../../types/api';

describe('libelleTypeMouvement', () => {
  it('donne le libellé des six types', () => {
    const attendus: Record<TypeMouvementStock, string> = {
      RECEPTION: 'Réception',
      TRANSFERT_ENTREE: 'Transfert reçu',
      TRANSFERT_SORTIE: 'Transfert envoyé',
      LIVRAISON: 'Livraison',
      RETOUR_EN_STOCK: 'Retour en stock',
      AJUSTEMENT: 'Ajustement',
    };
    for (const [type, libelle] of Object.entries(attendus)) {
      expect(libelleTypeMouvement(type as TypeMouvementStock)).toBe(libelle);
    }
  });
});

describe('libelleQuantiteMouvement', () => {
  it('signe la quantité', () => {
    expect(libelleQuantiteMouvement({ quantite: 25 })).toBe('+25');
    expect(libelleQuantiteMouvement({ quantite: -5 })).toBe('\u22125');
    expect(libelleQuantiteMouvement({ quantite: 0 })).toBe('0');
  });
});

describe('MOTIFS_AJUSTEMENT', () => {
  it('reprend les cinq motifs du back avec leurs libellés', () => {
    expect(MOTIFS_AJUSTEMENT).toEqual([
      { id: 'PERTE', label: 'Perte' },
      { id: 'PERIME', label: 'Périmé' },
      { id: 'CASSE', label: 'Casse' },
      { id: 'INVENTAIRE', label: 'Inventaire' },
      { id: 'AUTRE', label: 'Autre' },
    ]);
  });
});

describe('construireMiseAZero', () => {
  it('motif seul : commentaire omis', () => {
    expect(construireMiseAZero({ quantite: 7, motif: 'PERTE', commentaire: '   ' })).toEqual({
      ok: true,
      valeur: { motif: 'PERTE' },
    });
  });

  it('commentaire envoyé sans ses espaces', () => {
    expect(construireMiseAZero({ quantite: 7, motif: 'CASSE', commentaire: '  Sac percé ' })).toEqual({
      ok: true,
      valeur: { motif: 'CASSE', commentaire: 'Sac percé' },
    });
  });

  it('sans motif : « Choisissez un motif. »', () => {
    expect(construireMiseAZero({ quantite: 7, motif: null, commentaire: 'x' })).toEqual({
      ok: false,
      erreur: 'Choisissez un motif.',
    });
  });

  it('« Autre » exige un commentaire', () => {
    expect(construireMiseAZero({ quantite: 7, motif: 'AUTRE', commentaire: ' ' })).toEqual({
      ok: false,
      erreur: 'Précisez le motif dans le commentaire.',
    });
    expect(construireMiseAZero({ quantite: 7, motif: 'AUTRE', commentaire: 'Vol' }).ok).toBe(true);
  });

  it('commentaire de plus de 500 caractères refusé, 500 acceptés', () => {
    expect(construireMiseAZero({ quantite: 1, motif: 'PERTE', commentaire: 'a'.repeat(501) })).toEqual({
      ok: false,
      erreur: 'Le commentaire ne doit pas dépasser 500 caractères.',
    });
    expect(construireMiseAZero({ quantite: 1, motif: 'PERTE', commentaire: 'a'.repeat(500) }).ok).toBe(true);
  });

  it('stock déjà à zéro : refusé avant tout envoi', () => {
    expect(construireMiseAZero({ quantite: 0, motif: 'PERTE', commentaire: '' })).toEqual({
      ok: false,
      erreur: MESSAGES_MISE_A_ZERO.dejaAZero,
    });
    expect(MESSAGES_MISE_A_ZERO.dejaAZero).toBe('Le stock de ce produit est déjà à zéro.');
  });
});

describe('peutMettreAZero', () => {
  const racine = { id: 'root', parentId: null };
  const apprenti = { id: 'app-1', parentId: 'root' };

  it('le livreur principal : sur son propre stock', () => {
    expect(peutMettreAZero(racine, 'root')).toBe(true);
    expect(peutMettreAZero({ id: 'root' }, 'root')).toBe(true);
  });

  it('le livreur principal : sur le stock d’un de ses apprentis seulement', () => {
    expect(peutMettreAZero(racine, 'app-1', ['app-1', 'app-2'])).toBe(true);
    expect(peutMettreAZero(racine, 'autre', ['app-1'])).toBe(false);
  });

  it('un apprenti ne voit jamais l’action', () => {
    expect(peutMettreAZero(apprenti, 'app-1')).toBe(false);
    expect(peutMettreAZero(apprenti, 'app-1', ['app-1'])).toBe(false);
  });

  it('sans utilisateur ou sans cible : non', () => {
    expect(peutMettreAZero(null, 'root')).toBe(false);
    expect(peutMettreAZero(racine, null)).toBe(false);
  });
});
