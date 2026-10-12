import { listeEncaissements, nomClientEncaissement } from './liste';
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
