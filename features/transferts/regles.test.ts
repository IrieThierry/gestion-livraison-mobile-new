import {
  construireRefus,
  construireTransfert,
  LIBELLE_STATUT_TRANSFERT,
  MESSAGE_MOTIF_REFUS,
  messageAcceptationPar,
  nbTransfertsADecider,
  nomPrincipal,
  peutAnnulerTransfert,
  peutDeciderTransfert,
  transfertsAffiches,
} from './regles';
import type { TransfertStockResponse } from '../../types/api';

const t = (extra: Partial<TransfertStockResponse> = {}): TransfertStockResponse => ({
  id: 't1',
  source: { id: 'P1', prenom: 'Awa', nom: 'K' } as never,
  destinataire: { id: 'A1', prenom: 'Issa', nom: 'B' } as never,
  produit: { id: 'p1', designation: 'Pain' } as never,
  qte: 4,
  dateTransfert: '2026-10-12T10:00:00',
  commentaire: null,
  statut: 'EN_ATTENTE',
  motifRefus: null,
  initieParId: 'P1',
  decideParId: null,
  dateDecision: null,
  reprise: false,
  decideurId: 'A1',
  ...extra,
});

describe('statuts', () => {
  it('libellés des quatre statuts', () => {
    expect(LIBELLE_STATUT_TRANSFERT).toEqual({
      EN_ATTENTE: 'En attente',
      ACCEPTE: 'Accepté',
      REFUSE: 'Refusé',
      ANNULE: 'Annulé',
    });
  });
});

describe('actions selon le rôle', () => {
  it('le décideur accepte ou refuse un transfert en attente ; personne d’autre', () => {
    expect(peutDeciderTransfert(t(), 'A1')).toBe(true);
    expect(peutDeciderTransfert(t(), 'P1')).toBe(false);
    expect(peutDeciderTransfert(t({ statut: 'ACCEPTE' }), 'A1')).toBe(false);
    expect(peutDeciderTransfert(t(), undefined)).toBe(false);
  });

  it('l’initiateur annule un transfert en attente ; personne d’autre', () => {
    expect(peutAnnulerTransfert(t(), 'P1')).toBe(true);
    expect(peutAnnulerTransfert(t(), 'A1')).toBe(false);
    expect(peutAnnulerTransfert(t({ statut: 'REFUSE' }), 'P1')).toBe(false);
    // Reprise : lancée par le principal (destinataire), l'apprenti (source) décide.
    const reprise = t({
      source: { id: 'A1' } as never,
      destinataire: { id: 'P1' } as never,
      reprise: true,
      initieParId: 'P1',
      decideurId: 'A1',
    });
    expect(peutAnnulerTransfert(reprise, 'P1')).toBe(true);
    expect(peutDeciderTransfert(reprise, 'A1')).toBe(true);
    expect(peutDeciderTransfert(reprise, 'P1')).toBe(false);
  });

  it('compteur de la cloche : transferts en attente dont je suis le décideur', () => {
    const liste = [t(), t({ id: 't2' }), t({ id: 't3', statut: 'ACCEPTE' }), t({ id: 't4', decideurId: 'X' })];
    expect(nbTransfertsADecider(liste, 'A1')).toBe(2);
    expect(nbTransfertsADecider(undefined, 'A1')).toBe(0);
  });
});

describe('refus', () => {
  it('motif obligatoire, nettoyé, 500 caractères au plus', () => {
    expect(construireRefus('   ')).toEqual({ ok: false, erreur: MESSAGE_MOTIF_REFUS });
    expect(MESSAGE_MOTIF_REFUS).toBe('Précisez le motif du refus.');
    expect(construireRefus(' Pas commandé ')).toEqual({ ok: true, valeur: { motif: 'Pas commandé' } });
    expect(construireRefus('x'.repeat(501)).ok).toBe(false);
  });
});

describe('construireTransfert', () => {
  const base = { moiId: 'P1', produitId: 'p1', qte: '3', commentaire: '', stockDispo: 5 };

  it('envoyer : source = moi, destinataire = l’apprenti choisi', () => {
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1' })).toEqual({
      ok: true,
      valeur: { sourceId: 'P1', destinataireId: 'A1', produitId: 'p1', qte: 3 },
    });
  });

  it('reprendre : source = l’apprenti, destinataire = moi, motif facultatif', () => {
    expect(construireTransfert({ ...base, mode: 'reprendre', apprentiId: 'A1', commentaire: ' trop ' })).toEqual({
      ok: true,
      valeur: { sourceId: 'A1', destinataireId: 'P1', produitId: 'p1', qte: 3, commentaire: 'trop' },
    });
  });

  it('rendre : destinataire fixe = le principal', () => {
    expect(
      construireTransfert({ ...base, moiId: 'A1', mode: 'rendre', parentId: 'P1', apprentiId: 'X' }),
    ).toEqual({ ok: true, valeur: { sourceId: 'A1', destinataireId: 'P1', produitId: 'p1', qte: 3 } });
  });

  it('champs requis et stock', () => {
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: null })).toEqual({
      ok: false,
      erreur: 'Choisis un apprenti.',
    });
    expect(construireTransfert({ ...base, mode: 'rendre', parentId: null })).toEqual({
      ok: false,
      erreur: 'Aucun livreur principal.',
    });
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', produitId: null })).toEqual({
      ok: false,
      erreur: 'Choisis un produit.',
    });
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', qte: '0' })).toEqual({
      ok: false,
      erreur: 'Quantité invalide.',
    });
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', qte: '2.5' }).ok).toBe(false);
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', qte: '6' })).toEqual({
      ok: false,
      erreur: 'Stock insuffisant (max : 5).',
    });
  });
});

describe('textes', () => {
  it('qui devra accepter', () => {
    expect(messageAcceptationPar('Issa B')).toBe('Le transfert devra être accepté par Issa B.');
  });

  it('nom du principal lu dans les transferts de l’apprenti, sinon « ton livreur principal »', () => {
    expect(nomPrincipal([t()], 'P1')).toBe('Awa K');
    expect(nomPrincipal([t({ source: { id: 'A2', prenom: 'X', nom: 'Y' } as never })], 'P1')).toBe(
      'ton livreur principal',
    );
    expect(nomPrincipal(undefined, 'P1')).toBe('ton livreur principal');
  });
});

describe('liste', () => {
  it('filtre « En attente » et tri du plus récent au plus ancien', () => {
    const liste = [
      t({ id: 'a', dateTransfert: '2026-10-10T08:00:00', statut: 'ACCEPTE' }),
      t({ id: 'b', dateTransfert: '2026-10-12T08:00:00' }),
      t({ id: 'c', dateTransfert: '2026-10-11T08:00:00' }),
    ];
    expect(transfertsAffiches(liste, 'TOUS').map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(transfertsAffiches(liste, 'EN_ATTENTE').map((x) => x.id)).toEqual(['b', 'c']);
    expect(transfertsAffiches(undefined, 'TOUS')).toEqual([]);
  });
});
