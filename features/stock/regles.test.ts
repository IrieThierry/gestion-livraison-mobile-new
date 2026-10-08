import { libelleQuantiteMouvement, libelleTypeMouvement } from './regles';
import type { TypeMouvementStock } from '../../types/api';

describe('libelleTypeMouvement', () => {
  it('donne le libellé des cinq types', () => {
    const attendus: Record<TypeMouvementStock, string> = {
      RECEPTION: 'Réception',
      TRANSFERT_ENTREE: 'Transfert reçu',
      TRANSFERT_SORTIE: 'Transfert envoyé',
      LIVRAISON: 'Livraison',
      RETOUR_EN_STOCK: 'Retour en stock',
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
