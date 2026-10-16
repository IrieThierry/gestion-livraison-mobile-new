import type { LivreurPartenaireDuResponse, ReversementRecord, VersementResponse } from '../../types/api';
import {
  MESSAGE_MONTANT_REVERSEMENT,
  construireReversement,
  depasseNet,
  livreurDuVersement,
  nomPartenaire,
  periodeReversement,
  totalReverse,
  totauxVersements,
  trierReversements,
  trierVersements,
} from './argent';
import { lirePrixDeVente } from './gestion';

const versement = (over: Partial<VersementResponse>) =>
  ({
    id: 'v',
    livreur: { id: 'l1', nom: 'Yao', prenom: 'Awa' },
    dateVersement: '2026-10-06T00:00:00',
    montantVerse: 0,
    remiseLivreurCumulee: 0,
    ...over,
  }) as VersementResponse;

const reversement = (over: Partial<ReversementRecord>): ReversementRecord => ({
  id: 'r',
  type: 'FOURNISSEUR',
  beneficiaireId: 'l1',
  livreurId: 'l1',
  montant: 0,
  periodeMois: 10,
  periodeAnnee: 2026,
  dateReversement: '2026-10-10T00:00:00',
  commentaire: null,
  ...over,
});

describe('FM3 : versements reçus', () => {
  it('totaux : montant versé et remise livreur cumulée', () => {
    expect(
      totauxVersements([
        versement({ montantVerse: 50000, remiseLivreurCumulee: 2000 }),
        versement({ montantVerse: 25000, remiseLivreurCumulee: 500 }),
      ]),
    ).toEqual({ total: 75000, remise: 2500 });
    expect(totauxVersements(undefined)).toEqual({ total: 0, remise: 0 });
  });

  it('plus récents d’abord ; nom du livreur', () => {
    const tries = trierVersements([
      versement({ id: 'a', dateVersement: '2026-10-01T00:00:00' }),
      versement({ id: 'b', dateVersement: '2026-10-09T00:00:00' }),
    ]);
    expect(tries.map((v) => v.id)).toEqual(['b', 'a']);
    expect(livreurDuVersement(versement({}))).toBe('Awa Yao');
  });
});

describe('FM3 : reversements', () => {
  it('total : les lignes informatives (saisies par le livreur) ne comptent pas', () => {
    expect(
      totalReverse([reversement({ montant: 3000 }), reversement({ montant: 1000, informatif: true })]),
    ).toBe(3000);
  });

  it('historique trié, période, nom du livreur partenaire', () => {
    const tries = trierReversements([
      reversement({ id: 'a', dateReversement: '2026-09-01T00:00:00' }),
      reversement({ id: 'b', dateReversement: '2026-10-01T00:00:00' }),
    ]);
    expect(tries.map((r) => r.id)).toEqual(['b', 'a']);
    expect(periodeReversement(reversement({}))).toBe('octobre 2026');
    expect(periodeReversement(reversement({ periodeMois: 0 }))).toBe('');
    const partenaires = [{ livreur: { id: 'l1', nom: 'Yao', prenom: 'Awa' } }] as LivreurPartenaireDuResponse[];
    expect(nomPartenaire(partenaires, 'l1')).toBe('Awa Yao');
    expect(nomPartenaire(partenaires, 'x')).toBe('—');
    expect(nomPartenaire(partenaires, null)).toBe('—');
  });

  it('reverser : montant > 0 obligatoire ; type FOURNISSEUR au livreur, période du mois choisi', () => {
    const base = { livreurId: 'l1', mois: '2026-09', montant: '', commentaire: '' };
    expect(construireReversement(base)).toEqual({ ok: false, erreur: MESSAGE_MONTANT_REVERSEMENT });
    expect(construireReversement({ ...base, montant: '0' })).toEqual({ ok: false, erreur: MESSAGE_MONTANT_REVERSEMENT });
    expect(construireReversement({ ...base, montant: 'abc' }).ok).toBe(false);
    expect(construireReversement({ ...base, montant: '6 000,5', commentaire: ' Espèces ' })).toEqual({
      ok: true,
      valeur: { type: 'FOURNISSEUR', beneficiaireId: 'l1', montant: 6000.5, mois: 9, annee: 2026, commentaire: 'Espèces' },
    });
    expect(construireReversement({ ...base, montant: '6000' })).toEqual({
      ok: true,
      valeur: { type: 'FOURNISSEUR', beneficiaireId: 'l1', montant: 6000, mois: 9, annee: 2026 },
    });
  });

  it('dépasser le net n’est qu’un avertissement', () => {
    expect(depasseNet('7000', 6000)).toBe(true);
    expect(depasseNet('6000', 6000)).toBe(false);
  });
});

describe('FM3 : prix de vente (catalogue du web)', () => {
  it('obligatoire, > 0, 2 décimales, virgule acceptée', () => {
    expect(lirePrixDeVente('')).toEqual({ ok: false, erreur: 'Le prix de vente doit être supérieur à 0.' });
    expect(lirePrixDeVente('0')).toEqual({ ok: false, erreur: 'Le prix de vente doit être supérieur à 0.' });
    expect(lirePrixDeVente('-5')).toEqual({ ok: false, erreur: 'Le prix de vente doit être supérieur à 0.' });
    expect(lirePrixDeVente('12,505')).toEqual({ ok: false, erreur: 'Le prix de vente : 2 décimales au plus.' });
    expect(lirePrixDeVente('250,5')).toEqual({ ok: true, valeur: 250.5 });
  });
});
