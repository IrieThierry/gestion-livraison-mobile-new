import {
  PERIODES_ENCAISSEMENTS,
  PERIODE_ENCAISSEMENTS_DEFAUT,
  listeEncaissements,
  nomClientEncaissement,
} from './liste';
import { bornesPeriode } from '../../lib/periode';
import type { EncaissementLivraisonResponse } from '../../types/api';

const enc = (
  reference: string,
  date: string,
  montant: number | string,
  client: { prenom: string; nom: string } | null,
  livraisons: string[] = [],
) =>
  ({
    id: reference,
    reference,
    dateEncaissement: date,
    montantEncaisse: montant,
    client,
    commentaire: null,
    livraisons: livraisons.map((r) => ({ livraisonId: r, reference: r })),
  }) as unknown as EncaissementLivraisonResponse;

const liste = [
  enc('ENC-1', '2026-10-01T09:00:00', 1000, { prenom: 'Awa', nom: 'Koné' }, ['LIV-10']),
  enc('ENC-3', '2026-10-03T09:00:00', '2500.50', { prenom: 'Jean', nom: 'Kouassi' }, ['LIV-12']),
  enc('ENC-2', '2026-10-02T09:00:00', 500, null),
];

describe('listeEncaissements', () => {
  it('tri du plus récent au plus ancien et total de la liste', () => {
    const { lignes, total } = listeEncaissements(liste, '');
    expect(lignes.map((e) => e.reference)).toEqual(['ENC-3', 'ENC-2', 'ENC-1']);
    expect(total).toBe(4000.5);
  });

  it('recherche sur le client (sans accents) et les références, total des lignes affichées', () => {
    expect(listeEncaissements(liste, 'kone').lignes.map((e) => e.reference)).toEqual(['ENC-1']);
    expect(listeEncaissements(liste, 'enc-2').lignes.map((e) => e.reference)).toEqual(['ENC-2']);
    const parLivraison = listeEncaissements(liste, 'LIV-12');
    expect(parLivraison.lignes.map((e) => e.reference)).toEqual(['ENC-3']);
    expect(parLivraison.total).toBe(2500.5);
    expect(listeEncaissements(liste, 'zzz')).toEqual({ lignes: [], total: 0 });
  });

  it('nom du client, vide sans client', () => {
    expect(nomClientEncaissement(liste[0])).toBe('Awa Koné');
    expect(nomClientEncaissement(liste[2])).toBe('');
  });
});

describe('période de Mes encaissements', () => {
  it("7 j par défaut, avec Aujourd'hui, 7 j et 30 j", () => {
    expect(PERIODE_ENCAISSEMENTS_DEFAUT).toBe('7j');
    expect(PERIODES_ENCAISSEMENTS.map((o) => o.label)).toEqual(["Aujourd'hui", '7 j', '30 j']);
    const now = new Date(2026, 9, 13, 15, 0);
    expect(bornesPeriode({ cle: '7j' }, PERIODES_ENCAISSEMENTS, now)).toEqual({ debut: '2026-10-07', fin: '2026-10-13' });
  });

  it('la liste et le total suivent la période (jours entiers, bornes incluses)', () => {
    const r = listeEncaissements(liste, '', { debut: '2026-10-02', fin: '2026-10-03' });
    expect(r.lignes.map((e) => e.reference)).toEqual(['ENC-3', 'ENC-2']);
    expect(r.total).toBe(3000.5);
    expect(listeEncaissements(liste, 'kone', { debut: '2026-10-02' })).toEqual({ lignes: [], total: 0 });
    expect(listeEncaissements(liste, '', { debut: '2026-10-01', fin: '2026-10-01' }).total).toBe(1000);
  });
});
