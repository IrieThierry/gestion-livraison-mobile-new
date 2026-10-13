import {
  ajouterLigneTransfert,
  construireRefus,
  construireTransfert,
  libelleBonTransfert,
  lignesAuDelaDuStock,
  LIBELLE_STATUT_TRANSFERT,
  MESSAGE_BON_VIDE,
  MESSAGE_PRODUIT_EN_DOUBLE,
  qteSaisie,
  resumeLignesTransfert,
  MESSAGE_MOTIF_REFUS,
  messageAcceptationPar,
  messageAnnulationTransfert,
  TITRE_ANNULATION_TRANSFERT,
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
  reference: 'TRF-1',
  lignes: [{ produit: { id: 'p1', designation: 'Pain' } as never, qte: 4 }],
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
  const pain = { produitId: 'p1', designation: 'Pain', qte: 3 };
  const lait = { produitId: 'p2', designation: 'Lait', qte: 2 };
  const stock = new Map([
    ['p1', 5],
    ['p2', 2],
  ]);
  const base = { moiId: 'P1', lignes: [pain], commentaire: '', stock };

  it('envoyer : source = moi, destinataire = l’apprenti choisi', () => {
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1' })).toEqual({
      ok: true,
      valeur: { sourceId: 'P1', destinataireId: 'A1', lignes: [{ produitId: 'p1', qte: 3 }] },
    });
  });

  it('plusieurs lignes : toutes envoyées, dans l’ordre affiché', () => {
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', lignes: [lait, pain] })).toEqual({
      ok: true,
      valeur: {
        sourceId: 'P1',
        destinataireId: 'A1',
        lignes: [
          { produitId: 'p2', qte: 2 },
          { produitId: 'p1', qte: 3 },
        ],
      },
    });
  });

  it('reprendre : source = l’apprenti, destinataire = moi, commentaire facultatif', () => {
    expect(construireTransfert({ ...base, mode: 'reprendre', apprentiId: 'A1', commentaire: ' trop ' })).toEqual({
      ok: true,
      valeur: { sourceId: 'A1', destinataireId: 'P1', lignes: [{ produitId: 'p1', qte: 3 }], commentaire: 'trop' },
    });
  });

  it('rendre : destinataire fixe = le principal', () => {
    expect(
      construireTransfert({ ...base, moiId: 'A1', mode: 'rendre', parentId: 'P1', apprentiId: 'X' }),
    ).toEqual({ ok: true, valeur: { sourceId: 'A1', destinataireId: 'P1', lignes: [{ produitId: 'p1', qte: 3 }] } });
  });

  it('bon vide, produit en double : messages de la spec', () => {
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', lignes: [] })).toEqual({
      ok: false,
      erreur: 'Ajoutez au moins un produit au transfert.',
    });
    expect(MESSAGE_BON_VIDE).toBe('Ajoutez au moins un produit au transfert.');
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', lignes: [pain, pain] })).toEqual({
      ok: false,
      erreur: "Un produit ne peut figurer qu'une fois dans le transfert.",
    });
    expect(MESSAGE_PRODUIT_EN_DOUBLE).toBe("Un produit ne peut figurer qu'une fois dans le transfert.");
  });

  it('stock : une seule ligne au-delà du stock bloque le bon entier', () => {
    expect(
      construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', lignes: [{ ...lait, qte: 3 }, pain] }),
    ).toEqual({ ok: false, erreur: 'Lait : Quantité supérieure au stock disponible (2).' });
    // Produit absent du stock de la source : disponible 0.
    expect(
      construireTransfert({
        ...base,
        mode: 'envoyer',
        apprentiId: 'A1',
        lignes: [{ produitId: 'p9', designation: 'Sel', qte: 1 }],
      }),
    ).toEqual({ ok: false, erreur: 'Sel : Quantité supérieure au stock disponible (0).' });
    expect(lignesAuDelaDuStock([{ ...lait, qte: 3 }, pain], stock).map((l) => l.produitId)).toEqual(['p2']);
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
    expect(
      construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', lignes: [{ ...pain, qte: 0 }] }),
    ).toEqual({ ok: false, erreur: 'Quantité invalide pour Pain.' });
    expect(
      construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', lignes: [{ ...pain, qte: 2.5 }] }).ok,
    ).toBe(false);
    expect(
      construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', lignes: [{ ...pain, qte: 6 }] }),
    ).toEqual({ ok: false, erreur: 'Pain : Quantité supérieure au stock disponible (5).' });
  });

  it('commentaire : 500 caractères au plus, message du web', () => {
    const r = construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', commentaire: 'x'.repeat(500) });
    expect(r.ok && r.valeur.commentaire).toHaveLength(500);
    expect(construireTransfert({ ...base, mode: 'envoyer', apprentiId: 'A1', commentaire: 'x'.repeat(501) })).toEqual({
      ok: false,
      erreur: 'Le commentaire ne doit pas dépasser 500 caractères.',
    });
  });
});

describe('saisie du bon (comme une vente)', () => {
  it('le produit ajouté s’insère en tête, une seule fois, quantité 1', () => {
    const une = ajouterLigneTransfert([], { id: 'p1', designation: 'Pain' });
    expect(une).toEqual([{ produitId: 'p1', designation: 'Pain', qte: 1 }]);
    const deux = ajouterLigneTransfert([{ ...une[0], qte: 4 }], { id: 'p2', designation: 'Lait' });
    expect(deux.map((l) => [l.produitId, l.qte])).toEqual([
      ['p2', 1],
      ['p1', 4],
    ]);
    expect(ajouterLigneTransfert(deux, { id: 'p1', designation: 'Pain' })).toEqual(deux);
  });

  it('quantité saisie : chiffres seulement, vide = 0', () => {
    expect(qteSaisie('12')).toBe(12);
    expect(qteSaisie('1a2')).toBe(12);
    expect(qteSaisie('')).toBe(0);
  });
});

describe('bon de transfert : référence et lignes', () => {
  it('résumé des lignes et libellé avec la référence', () => {
    const bon = t({
      lignes: [
        { produit: { id: 'p1', designation: 'Pain' } as never, qte: 4 },
        { produit: { id: 'p2', designation: 'Lait' } as never, qte: 2 },
      ],
    });
    expect(resumeLignesTransfert(bon)).toBe('4 × Pain, 2 × Lait');
    expect(libelleBonTransfert(bon)).toBe('TRF-1 · 4 × Pain, 2 × Lait');
    expect(resumeLignesTransfert(t({ lignes: [] }))).toBe('—');
    expect(libelleBonTransfert(t({ reference: '' }))).toBe('4 × Pain');
  });
});

describe('textes', () => {
  it('qui devra accepter', () => {
    expect(messageAcceptationPar('Issa B')).toBe('Le transfert devra être accepté par Issa B.');
  });

  it('annulation : titre et message du web', () => {
    expect(TITRE_ANNULATION_TRANSFERT).toBe('Annuler le transfert ?');
    expect(messageAnnulationTransfert(t())).toBe(
      '4 × Pain vers Issa B : la quantité revient dans le stock de l’expéditeur.',
    );
    expect(
      messageAnnulationTransfert(t({ reprise: true, destinataire: { id: 'P1', prenom: 'Awa', nom: 'K' } as never })),
    ).toBe('4 × Pain vers Awa K.');
  });

  it('nom du principal lu dans les transferts de l’apprenti, sinon « ton livreur principal »', () => {
    expect(nomPrincipal([t()], 'P1')).toBe('Awa K');
    expect(nomPrincipal([t({ source: { id: 'A2', prenom: 'X', nom: 'Y' } as never })], 'P1')).toBe(
      'ton livreur principal',
    );
    expect(nomPrincipal(undefined, 'P1')).toBe('ton livreur principal');
  });

  it('nom du principal : `parent` des transferts, puis remises, comme le web', () => {
    const principal = { id: 'P1', prenom: 'Awa', nom: 'K' } as never;
    // Transfert entre apprentis frères : le principal n'est que le `parent`.
    const freres = t({
      source: { id: 'A1', prenom: 'Issa', nom: 'B', parent: principal } as never,
      destinataire: { id: 'A2', prenom: 'Moussa', nom: 'C', parent: null } as never,
    });
    expect(nomPrincipal([freres], 'P1')).toBe('Awa K');
    const freres2 = t({
      source: { id: 'A2', prenom: 'Moussa', nom: 'C', parent: null } as never,
      destinataire: { id: 'A1', prenom: 'Issa', nom: 'B', parent: principal } as never,
    });
    expect(nomPrincipal([freres2], 'P1')).toBe('Awa K');
    // Aucun transfert : le principal des remises.
    expect(nomPrincipal([], 'P1', [{ principal: null }, { principal }])).toBe('Awa K');
    expect(nomPrincipal(undefined, 'P1', [{ principal: null }])).toBe('ton livreur principal');
    expect(nomPrincipal(undefined, null, [{ principal }])).toBe('ton livreur principal');
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
