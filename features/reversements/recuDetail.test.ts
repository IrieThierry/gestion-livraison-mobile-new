import type { CommandeResponse, LivraisonResponse, RetourResponse } from '../../types/api';
import {
  AUCUN_DETAIL,
  COLONNES_DETAIL_CLIENT,
  COLONNES_DETAIL_LIVREUR,
  DETAIL_AUCUN,
  DETAIL_EN_ECHEC,
  DETAIL_INDISPONIBLE,
  detailClient,
  detailLivreur,
  periodeDuReversement,
  tableauDetail,
} from './recuDetail';

const OCTOBRE = { debut: '2026-10-01', fin: '2026-10-31' };
const prod = (id: string) => ({ id, designation: id });

const livraison = (
  clientId: string,
  date: string,
  lignes: Array<{ p: string; livre: number; retourne?: number; prix: number; remise?: number }>,
) =>
  ({
    id: `l-${date}`,
    date,
    client: { id: clientId },
    produitsLivraison: lignes.map((l) => ({
      produit: prod(l.p),
      qteLivre: l.livre,
      qteRetourne: l.retourne ?? 0,
      prixDeVente: l.prix,
      remiseUnitaire: l.remise ?? 0,
    })),
  }) as unknown as LivraisonResponse;

const retour = (clientId: string, p: string, quantite: number, dateRetour: string) =>
  ({ id: `r-${p}-${quantite}`, client: { id: clientId }, produit: prod(p), quantite, dateRetour }) as unknown as RetourResponse;

describe('periodeDuReversement', () => {
  it('mois civil du reversement, jours inclus ; null sans période', () => {
    expect(periodeDuReversement({ periodeMois: 10, periodeAnnee: 2026 })).toEqual(OCTOBRE);
    expect(periodeDuReversement({ periodeMois: 2, periodeAnnee: 2028 })).toEqual({ debut: '2028-02-01', fin: '2028-02-29' });
    expect(periodeDuReversement({ periodeMois: 0, periodeAnnee: 2026 })).toBeNull();
    expect(periodeDuReversement({ periodeMois: null, periodeAnnee: null } as never)).toBeNull();
  });
});

describe('detailClient', () => {
  const livraisons = [
    // Pain : 10 livrés dont 2 déjà retournés sur la livraison, prix 100, remise 10.
    livraison('c1', '2026-10-03T09:00:00', [
      { p: 'Pain', livre: 10, retourne: 2, prix: 100, remise: 10 },
      { p: 'Lait', livre: 4, prix: 500 },
    ]),
    livraison('c1', '2026-10-20T09:00:00', [{ p: 'Pain', livre: 5, prix: 100, remise: 10 }]),
    // Autre client, autre mois : ignorés.
    livraison('c2', '2026-10-05T09:00:00', [{ p: 'Pain', livre: 99, prix: 100 }]),
    livraison('c1', '2026-09-30T23:00:00', [{ p: 'Pain', livre: 99, prix: 100 }]),
  ];
  const retours = [
    retour('c1', 'Pain', 3, '2026-10-04T10:00:00'),
    retour('c1', 'Pain', -1, '2026-10-05T10:00:00'), // correction : déduite
    retour('c1', 'Sucre', 2, '2026-10-06T10:00:00'), // produit retourné, non vendu dans le mois
    retour('c1', 'Pain', 7, '2026-11-01T10:00:00'), // hors mois
    retour('c2', 'Pain', 7, '2026-10-06T10:00:00'), // autre client
  ];

  it('une ligne par produit : vendu, retourné net, net, montant et remise de l’état Ventes', () => {
    const d = detailClient(livraisons, retours, 'c1', OCTOBRE);
    expect(d.lignes).toEqual([
      { produitId: 'Lait', designation: 'Lait', qteVendue: 4, qteRetournee: 0, qteNette: 4, montant: 2000, remise: 0 },
      // (100 + 10) × (10 − 2) + (100 + 10) × 5 = 1430 ; remise 10 × 8 + 10 × 5 = 130.
      { produitId: 'Pain', designation: 'Pain', qteVendue: 15, qteRetournee: 2, qteNette: 13, montant: 1430, remise: 130 },
      { produitId: 'Sucre', designation: 'Sucre', qteVendue: 0, qteRetournee: 2, qteNette: -2, montant: 0, remise: 0 },
    ]);
    expect(d.totaux).toEqual({ qteVendue: 19, qteRetournee: 4, qteNette: 15, montant: 3430, remise: 130 });
  });

  it('mois sans données : aucune ligne', () => {
    expect(detailClient(livraisons, retours, 'c1', { debut: '2026-08-01', fin: '2026-08-31' }).lignes).toEqual([]);
  });
});

describe('detailLivreur', () => {
  const ligne = (p: string, quantite: number, prixUnitaire: number) => ({
    produit: prod(p),
    quantite,
    prixUnitaire,
    remiseLivreurUnitaire: 0,
  });
  const commande = (
    id: string,
    date: string,
    fournisseurId: string,
    receptions: Array<{ date: string; annulee?: boolean; lignes: ReturnType<typeof ligne>[] }>,
  ) =>
    ({
      id,
      reference: id,
      date,
      livreur: { id: 'liv-1' },
      fournisseur: { id: fournisseurId },
      receptions: receptions.map((r, i) => ({ id: `${id}-r${i}`, dateReception: r.date, annulee: !!r.annulee, lignes: r.lignes })),
    }) as unknown as CommandeResponse;

  const commandes = [
    commande('CMD-2', '2026-10-10T08:00:00', 'f1', [
      { date: '2026-10-11T08:00:00', lignes: [ligne('Pain', 20, 80), ligne('Lait', 6, 400)] },
      { date: '2026-10-12T08:00:00', lignes: [ligne('Pain', 5, 80)] },
      { date: '2026-10-13T08:00:00', annulee: true, lignes: [ligne('Pain', 100, 80)] },
    ]),
    // Commandée en septembre, reçue en octobre : comptée.
    commande('CMD-1', '2026-09-28T08:00:00', 'f1', [{ date: '2026-10-01T08:00:00', lignes: [ligne('Pain', 10, 75)] }]),
    // Reçue hors mois, autre fournisseur, ou sans réception : ignorées.
    commande('CMD-3', '2026-10-25T08:00:00', 'f1', [{ date: '2026-11-02T08:00:00', lignes: [ligne('Pain', 9, 80)] }]),
    commande('CMD-4', '2026-10-05T08:00:00', 'f2', [{ date: '2026-10-06T08:00:00', lignes: [ligne('Pain', 9, 80)] }]),
    commande('CMD-5', '2026-10-05T08:00:00', 'f1', []),
  ];

  it('par commande, une ligne par produit des réceptions actives du mois au prix de réception', () => {
    const d = detailLivreur(commandes, { livreurId: null, fournisseurId: 'f1' }, OCTOBRE);
    expect(d.commandes.map((c) => c.reference)).toEqual(['CMD-1', 'CMD-2']);
    expect(d.commandes[0].lignes).toEqual([{ produitId: 'Pain', designation: 'Pain', quantite: 10, montant: 750 }]);
    expect(d.commandes[1].lignes).toEqual([
      { produitId: 'Lait', designation: 'Lait', quantite: 6, montant: 2400 },
      { produitId: 'Pain', designation: 'Pain', quantite: 25, montant: 2000 },
    ]);
    expect(d.commandes[1].sousTotal).toEqual({ quantite: 31, montant: 4400 });
    expect(d.totaux).toEqual({ quantite: 41, montant: 5150 });
  });

  it('filtre livreur facultatif', () => {
    expect(detailLivreur(commandes, { livreurId: 'autre', fournisseurId: null }, OCTOBRE).commandes).toEqual([]);
  });
});

describe('tableauDetail', () => {
  it('client : colonnes, lignes et total en pied', () => {
    const t = tableauDetail(
      detailClient([livraison('c1', '2026-10-03T09:00:00', [{ p: 'Pain', livre: 1500, prix: 100, remise: 10 }])], [], 'c1', OCTOBRE),
    );
    expect(t.titre).toBe('Détail sur la période');
    expect(t.colonnes.map((c) => c.libelle)).toEqual([...COLONNES_DETAIL_CLIENT]);
    expect(t.colonnes.map((c) => c.droite)).toEqual([false, true, true, true, true, true]);
    const espace = (s: string) => s.replace(/\s/g, ' ');
    expect(t.lignes.map((l) => l.map(espace))).toEqual([['Pain', '1 500', '0', '1 500', '165 000 F CFA', '15 000 F CFA']]);
    expect(t.totaux?.map(espace)).toEqual(['Total', '1 500', '0', '1 500', '165 000 F CFA', '15 000 F CFA']);
  });

  it('livreur : sous-total par commande et total général', () => {
    const d = {
      type: 'livreur' as const,
      commandes: [
        {
          id: 'x',
          reference: 'CMD-7',
          date: '2026-10-02T08:00:00',
          lignes: [
            { produitId: 'a', designation: 'Lait', quantite: 2, montant: 800 },
            { produitId: 'b', designation: 'Pain', quantite: 3, montant: 240 },
          ],
          sousTotal: { quantite: 5, montant: 1040 },
        },
      ],
      totaux: { quantite: 5, montant: 1040 },
    };
    const t = tableauDetail(d);
    expect(t.colonnes.map((c) => c.libelle)).toEqual([...COLONNES_DETAIL_LIVREUR]);
    expect(t.lignes.map((l) => l.join('|').replace(/\s/g, ' '))).toEqual([
      'CMD-7|02/10/2026|Lait|2|800 F CFA',
      'CMD-7|02/10/2026|Pain|3|240 F CFA',
      'Sous-total CMD-7|||5|1 040 F CFA',
    ]);
    expect(t.sousTotaux).toEqual([2]);
    expect(t.totaux?.join('|').replace(/\s/g, ' ')).toBe('Total|||5|1 040 F CFA');
  });

  it('sans période ou sans ligne : « Aucun détail sur la période » ; lecture en échec : « Détail indisponible »', () => {
    expect(tableauDetail(DETAIL_AUCUN)).toMatchObject({ lignes: [], vide: 'Aucun détail sur la période' });
    expect(tableauDetail(detailClient([], [], 'c1', OCTOBRE))).toMatchObject({ lignes: [], totaux: undefined, vide: AUCUN_DETAIL });
    expect(tableauDetail({ type: 'livreur', commandes: [], totaux: { quantite: 0, montant: 0 } }).vide).toBe(AUCUN_DETAIL);
    expect(tableauDetail(DETAIL_EN_ECHEC)).toMatchObject({ lignes: [], vide: 'Détail indisponible' });
    expect(DETAIL_INDISPONIBLE).toBe('Détail indisponible');
  });
});
