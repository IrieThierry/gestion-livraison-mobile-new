import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  champsRecu,
  genererHtmlRecu,
  MENTION_INFORMATIF,
  montantRecu,
  NON_PRECISE,
  nomFichierRecu,
  partiesReversement,
  recuReversement,
  SIGNATURES_RECU,
  type AnnuaireRecu,
} from './recu';
import { partagerRecu } from './partageRecu';
import type { ReversementRecord } from '../../types/api';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
}));

// Même jeu de données que le test web (src/__tests__/recu-reversement.test.ts).
const reversement = (partiel: Partial<ReversementRecord>): ReversementRecord => ({
  id: 'rev-1',
  type: 'CLIENT',
  beneficiaireId: 'c1',
  montant: 12500,
  periodeMois: 10,
  periodeAnnee: 2026,
  dateReversement: '2026-10-08T00:00:00',
  livreurId: 'l1',
  commentaire: null,
  saisiPar: 'LIVREUR',
  informatif: false,
  ...partiel,
});

const annuaire: AnnuaireRecu = {
  client: (id) => (id === 'c1' ? 'Marie Kouassi' : null),
  livreur: (id) =>
    id === 'l1' ? { nom: 'Ahmed Koné', apprenti: false } : id === 'a1' ? { nom: 'Awa Traoré', apprenti: true } : null,
  fournisseur: (id) => (id === 'f1' ? 'Boulangerie Soleil' : null),
};
const editeLe = new Date(2026, 9, 11, 14, 5);
const espaces = (s: string) => s.replace(/\s/g, ' ');

describe('reçu de reversement : parties', () => {
  it('CLIENT : le client reçoit, le livreur du client paie (apprenti nommé comme tel)', () => {
    expect(partiesReversement(reversement({}), annuaire)).toEqual({
      beneficiaire: { nom: 'Marie Kouassi', qualite: 'Client' },
      payeur: { nom: 'Ahmed Koné', qualite: 'Livreur' },
    });
    expect(partiesReversement(reversement({ livreurId: 'a1' }), annuaire).payeur).toEqual({
      nom: 'Awa Traoré',
      qualite: 'Livreur apprenti',
    });
  });

  it('FOURNISSEUR : le livreur reçoit, le fournisseur paie', () => {
    const r = reversement({ type: 'FOURNISSEUR', beneficiaireId: 'f1', saisiPar: 'FOURNISSEUR' });
    expect(partiesReversement(r, annuaire)).toEqual({
      beneficiaire: { nom: 'Ahmed Koné', qualite: 'Livreur' },
      payeur: { nom: 'Boulangerie Soleil', qualite: 'Fournisseur' },
    });
  });

  it('nom introuvable : « Non précisé »', () => {
    const r = reversement({ type: 'FOURNISSEUR', beneficiaireId: 'f9', livreurId: null });
    expect(partiesReversement(r, annuaire)).toEqual({
      beneficiaire: { nom: NON_PRECISE, qualite: 'Livreur' },
      payeur: { nom: NON_PRECISE, qualite: 'Fournisseur' },
    });
  });
});

describe('reçu de reversement : contenu et fichier', () => {
  it('nom de fichier sans accents ni espaces, date du reversement', () => {
    expect(nomFichierRecu('Éloïse N’Guessan', '2026-10-08T15:30:00')).toBe(
      'Recu-reversement_Eloise-N-Guessan_2026-10-08.pdf',
    );
    expect(nomFichierRecu('', '2026-10-08')).toBe('Recu-reversement_Beneficiaire_2026-10-08.pdf');
  });

  it('champs, montant en F CFA, période, motif, signatures et date d’édition', () => {
    const r = reversement({ commentaire: 'Remise de septembre' });
    const recu = recuReversement(r, partiesReversement(r, annuaire), editeLe);
    expect(recu).toMatchObject({
      application: 'Gestion Livraison',
      titre: 'Reçu de reversement',
      reference: 'rev-1',
      date: '08/10/2026',
      montant: 12500,
      periode: 'Octobre 2026',
      motif: 'Remise de septembre',
      informatif: false,
      editeLe: '11/10/2026 à 14:05',
      nomFichier: 'Recu-reversement_Marie-Kouassi_2026-10-08.pdf',
    });
    expect(champsRecu(recu)).toEqual([
      { libelle: 'Référence', valeur: 'rev-1' },
      { libelle: 'Date du reversement', valeur: '08/10/2026' },
      { libelle: 'Bénéficiaire', valeur: 'Marie Kouassi (Client)' },
      { libelle: 'Payeur', valeur: 'Ahmed Koné (Livreur)' },
      { libelle: 'Période', valeur: 'Octobre 2026' },
      { libelle: 'Motif', valeur: 'Remise de septembre' },
    ]);
    expect(espaces(montantRecu(recu.montant))).toBe('12 500 F CFA');

    const html = espaces(genererHtmlRecu(recu));
    expect(html).toContain('Gestion Livraison');
    expect(html).toContain('<h1>Reçu de reversement</h1>');
    expect(html).toContain('12 500 F CFA');
    expect(html).toContain('Marie Kouassi (Client)');
    for (const s of SIGNATURES_RECU) expect(html).toContain(s);
    expect(html).toContain('Édité le 11/10/2026 à 14:05');
    expect(html).not.toContain('Informatif');
  });

  it('reversement informatif : mention « Informatif » ; sans motif, pas de ligne Motif', () => {
    const r = reversement({ type: 'FOURNISSEUR', beneficiaireId: 'f1', informatif: true });
    const recu = recuReversement(r, partiesReversement(r, annuaire), editeLe);
    expect(MENTION_INFORMATIF).toMatch(/^Informatif/);
    expect(genererHtmlRecu(recu)).toContain(MENTION_INFORMATIF);
    expect(champsRecu(recu).map((c) => c.libelle)).not.toContain('Motif');
  });

  it('bénéficiaire inconnu : fichier « Beneficiaire » ; texte échappé', () => {
    const r = reversement({ type: 'FOURNISSEUR', beneficiaireId: 'f1', livreurId: null, commentaire: '<b>x</b>' });
    const recu = recuReversement(r, partiesReversement(r, annuaire), editeLe);
    expect(recu.nomFichier).toBe('Recu-reversement_Beneficiaire_2026-10-08.pdf');
    expect(genererHtmlRecu(recu)).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('partagerRecu', () => {
  it('PDF nommé Recu-reversement_…pdf (sans double extension) puis partage', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Print.printToFileAsync as jest.Mock).mockResolvedValue({ uri: 'file:///cache/Print/x.pdf' });
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.moveAsync as jest.Mock).mockResolvedValue(undefined);
    const r = reversement({});
    const uri = await partagerRecu(recuReversement(r, partiesReversement(r, annuaire), editeLe));
    expect(uri).toBe('file:///cache/Recu-reversement_Marie-Kouassi_2026-10-08.pdf');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: 'application/pdf' }));
  });
});
