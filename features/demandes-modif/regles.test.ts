import {
  AUCUNE_MODIFICATION,
  MONTANT_INVALIDE,
  MOTIF_DEMANDE_OBLIGATOIRE,
  MOTIF_REJET_OBLIGATOIRE,
  champsModifies,
  construireDemandeModif,
  estADecider,
  estADeciderPour,
  libelleDemandeur,
  separerDemandes,
  validerMotifRejet,
} from './regles';
import type { DemandeModificationVersementResponse, VersementResponse } from '../../types/api';

const demande = (
  id: string,
  over: Partial<DemandeModificationVersementResponse> = {},
): DemandeModificationVersementResponse => ({
  id,
  versementId: 'v1',
  demandeurType: 'FOURNISSEUR',
  demandeurLibelle: 'BRASSERIE DU SUD',
  payloadModif: { montantVerse: 45000 },
  motifDemande: 'Erreur de saisie',
  statut: 'PENDING',
  decideLe: null,
  motifDecision: null,
  createdAt: '2026-10-10T09:00:00',
  ...over,
});

const versement = {
  dateDebut: '2026-10-01T00:00:00',
  dateFin: '2026-10-05T00:00:00',
  dateVersement: '2026-10-06T00:00:00',
  montantVerse: 50000,
  commentaire: null,
} as unknown as VersementResponse;

describe('N7 : demandes de modification de versement', () => {
  it('à décider : en attente et initiée par le fournisseur', () => {
    expect(estADecider(demande('1'))).toBe(true);
    expect(estADecider(demande('1', { demandeurType: 'LIVREUR' }))).toBe(false);
    expect(estADecider(demande('1', { statut: 'APPROVED' }))).toBe(false);
  });

  it('séparation : en attente (à décider d’abord) et historique, plus récentes en premier', () => {
    const { enAttente, historique } = separerDemandes([
      demande('mienne', { demandeurType: 'LIVREUR', createdAt: '2026-10-12T09:00:00' }),
      demande('ancienne', { createdAt: '2026-10-08T09:00:00' }),
      demande('recue', { createdAt: '2026-10-11T09:00:00' }),
      demande('h1', { statut: 'APPROVED', createdAt: '2026-10-01T09:00:00' }),
      demande('h2', { statut: 'REJECTED', createdAt: '2026-10-03T09:00:00' }),
    ]);
    expect(enAttente.map((d) => d.id)).toEqual(['recue', 'ancienne', 'mienne']);
    expect(historique.map((d) => d.id)).toEqual(['h2', 'h1']);
  });

  it('FM3, fournisseur : décide des demandes du livreur ; les siennes sont « initiées par moi »', () => {
    const duLivreur = demande('l', { demandeurType: 'LIVREUR', demandeurLibelle: 'Awa Yao', createdAt: '2026-10-08T09:00:00' });
    const mienne = demande('f', { createdAt: '2026-10-12T09:00:00' });
    expect(estADeciderPour('fournisseur')(duLivreur)).toBe(true);
    expect(estADeciderPour('fournisseur')(mienne)).toBe(false);
    expect(separerDemandes([mienne, duLivreur], 'fournisseur').enAttente.map((d) => d.id)).toEqual(['l', 'f']);
    expect(libelleDemandeur(mienne, 'fournisseur')).toBe('Initiée par moi');
    expect(libelleDemandeur(duLivreur, 'fournisseur')).toBe('Initiée par Awa Yao');
    expect(libelleDemandeur({ ...duLivreur, demandeurLibelle: null }, 'fournisseur')).toBe('Initiée par le livreur');
  });

  it('initiateur', () => {
    expect(libelleDemandeur(demande('1'))).toBe('Initiée par BRASSERIE DU SUD');
    expect(libelleDemandeur(demande('1', { demandeurLibelle: null }))).toBe('Initiée par le fournisseur');
    expect(libelleDemandeur(demande('1', { demandeurType: 'LIVREUR' }))).toBe('Initiée par moi');
  });

  it('champs demandés : avant → après', () => {
    const champs = champsModifies(
      { dateVersement: '2026-10-07T00:00:00', montantVerse: 45000, commentaire: 'Corrigé' },
      versement,
    );
    expect(champs.map((c) => c.libelle)).toEqual(['Date de versement', 'Montant', 'Commentaire']);
    expect(champs[1].avant).toMatch(/^50\s000 F$/);
    expect(champs[1].apres).toMatch(/^45\s000 F$/);
    expect(champs[2]).toEqual({ libelle: 'Commentaire', avant: '—', apres: 'Corrigé' });
    // Versement inconnu : pas de valeur avant.
    expect(champsModifies({ montantVerse: 0 }, undefined)).toEqual([
      { libelle: 'Montant', avant: null, apres: '0 F' },
    ]);
    expect(champsModifies({ dateDebut: '2026-10-02T00:00:00' }, versement)[0].libelle).toBe('Début');
    expect(champsModifies(null, versement)).toEqual([]);
  });

  it('motif de rejet obligatoire', () => {
    expect(validerMotifRejet('  ')).toEqual({ ok: false, erreur: MOTIF_REJET_OBLIGATOIRE });
    expect(validerMotifRejet(' Montant juste ')).toEqual({ ok: true, valeur: 'Montant juste' });
  });

  it('demande : au moins un champ, montant valide, motif obligatoire', () => {
    const base = { versementId: 'v1', dateVersement: null, montantVerse: '', commentaire: '', motif: 'Erreur' };
    expect(construireDemandeModif(base)).toEqual({ ok: false, erreur: AUCUNE_MODIFICATION });
    expect(construireDemandeModif({ ...base, montantVerse: '-5' })).toEqual({ ok: false, erreur: MONTANT_INVALIDE });
    expect(construireDemandeModif({ ...base, montantVerse: '45000', motif: ' ' })).toEqual({
      ok: false,
      erreur: MOTIF_DEMANDE_OBLIGATOIRE,
    });
    expect(
      construireDemandeModif({
        ...base,
        dateVersement: '2026-10-07',
        montantVerse: '45 000',
        commentaire: ' Corrigé ',
      }),
    ).toEqual({
      ok: true,
      valeur: {
        versementId: 'v1',
        payloadModif: { dateVersement: '2026-10-07', montantVerse: 45000, commentaire: 'Corrigé' },
        motifDemande: 'Erreur',
      },
    });
  });
});
