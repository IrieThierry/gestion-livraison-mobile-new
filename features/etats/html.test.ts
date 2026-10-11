import { formatMontant } from '../../lib/format';
import { calculerEtatVentes } from './calculs/ventes';
import { calculerEtatStock } from './calculs/stock';
import { calculerEtatEncaissements } from './calculs/encaissements';
import { calculerEtatFournisseurs } from './calculs/fournisseurs';
import {
  documentEncaissements,
  documentFournisseurs,
  documentStock,
  documentVentes,
  type EnteteEtat,
} from './document';
import { echapperHtml, formatEdition, genererHtmlEtat, NOM_APPLICATION } from './html';
import {
  PERIODE_OCTOBRE as P,
  encaissement,
  encours,
  ligneLivraison,
  livraison,
  mouvement,
} from './calculs/etats.fixture';

const entete: EnteteEtat = {
  livreur: 'Awa Kone',
  periode: P,
  editeLe: new Date(2026, 9, 11, 14, 5),
  equipe: false,
};

const livraisons = [
  livraison({
    id: '1',
    date: '2026-10-02T09:00:00',
    clientId: 'c1',
    client: 'Ali <script>alert("x")</script>',
    montantDu: 12500.5,
    remiseNette: -250,
    lignes: [ligneLivraison('p1', 'Eau & "Jus" l\'orange', 5, 0, 2550.1, -50)],
  }),
];

describe('echapperHtml', () => {
  it('échappe & < > " \'', () => {
    expect(echapperHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
    expect(echapperHtml(null)).toBe('');
  });
});

describe('genererHtmlEtat', () => {
  const doc = documentVentes(calculerEtatVentes(livraisons, P), entete);
  const html = genererHtmlEtat(doc);

  it('en-tête : application, titre, livreur, période et date d’édition', () => {
    expect(html).toContain(NOM_APPLICATION);
    expect(html).toContain('<h1>Ventes / livraisons</h1>');
    expect(html).toContain('Livreur : <b>Awa Kone</b>');
    expect(html).toContain('du 01/10/2026 au 31/10/2026');
    expect(html).toContain(`Édité le ${formatEdition(entete.editeLe)}`);
    expect(formatEdition(entete.editeLe)).toBe('11/10/2026 à 14:05');
    expect(html).toContain('<footer>');
  });

  it('totaux en pied de tableau, identiques à l’aperçu', () => {
    expect(html).toContain('<tfoot>');
    for (const section of doc.sections) {
      for (const total of section.totaux ?? []) {
        if (total) expect(html).toContain(`>${echapperHtml(total)}</td>`);
      }
    }
    expect(html).toContain(formatMontant(12500.5));
    expect(html).toContain(formatMontant(-250));
  });

  it('échappe les caractères spéciaux des noms et des désignations', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('Ali &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('Eau &amp; &quot;Jus&quot; l&#39;orange');
  });

  it('vue équipe : colonne Livreur', () => {
    const equipe = genererHtmlEtat(
      documentVentes(calculerEtatVentes(livraisons, P), { ...entete, equipe: true }),
    );
    expect(equipe).toContain('<th>Livreur</th>');
    expect(html).not.toContain('<th>Livreur</th>');
  });

  it('période vide : messages vides, sans tableau ni erreur', () => {
    const vide = genererHtmlEtat(documentVentes(calculerEtatVentes([], P), entete));
    expect(vide).not.toContain('<table>');
    expect(vide).toContain('Aucune livraison sur la période.');
    expect(vide).toContain('Aucun produit livré sur la période.');
  });

  it('stock : l’ajustement apparaît avec son libellé et son motif', () => {
    const s = genererHtmlEtat(
      documentStock(
        calculerEtatStock([], [mouvement('AJUSTEMENT', '2026-10-06T09:00:00', -13, 'Eau', 'Périmé')], P),
        entete,
      ),
    );
    expect(s).toContain('<td>Ajustement</td>');
    expect(s).toContain('Motif : Périmé');
    expect(s).toContain('−13');
  });

  it('créances : « Solde actuel »', () => {
    const e = genererHtmlEtat(
      documentEncaissements(
        calculerEtatEncaissements(
          [encaissement({ id: 'a', date: '2026-10-03T10:00:00', client: 'Ali Traore', montant: 2000 })],
          [encours('c1', 'Ali Traore', 3000)],
          P,
        ),
        entete,
      ),
    );
    expect(e).toContain('Solde actuel');
    expect(e).toContain(formatMontant(3000));
  });

  it('fournisseurs : sections vides sans erreur', () => {
    const f = genererHtmlEtat(documentFournisseurs(calculerEtatFournisseurs([], [], [], P), entete));
    expect(f).toContain('Aucune commande sur la période.');
    expect(f).toContain('Aucun versement sur la période.');
  });

  it('fournisseurs : « Reçu » a un seul sens par colonne (période vs total commande)', () => {
    const d = documentFournisseurs(calculerEtatFournisseurs([], [], [], P), entete);
    const colonnes = d.sections.flatMap((x) => x.colonnes.map((c) => c.libelle));
    expect(colonnes).not.toContain('Reçu');
    expect(colonnes).toContain('Reçu sur la période');
    expect(colonnes).toContain('Reçu (total commande)');
    expect(d.syntheses.map((x) => x.libelle)).toContain('Reçu sur la période');
    expect(genererHtmlEtat(d)).toContain('y compris hors période');
  });
});

describe('filtres dans le document et le PDF', () => {
  const filtres = {
    client: { id: 'c1', label: 'Kouassi Jean' },
    produit: { id: 'p1', label: 'Eau 1,5 L' },
    fournisseur: null,
    typeMouvement: null,
  };

  it('une ligne par filtre actif dans l’en-tête, nom de fichier avec les entités', () => {
    const doc = documentVentes(calculerEtatVentes(livraisons, P), { ...entete, filtres });
    expect(doc.filtres).toEqual([
      { libelle: 'Client', valeur: 'Kouassi Jean' },
      { libelle: 'Produit', valeur: 'Eau 1,5 L' },
    ]);
    expect(doc.nomFichier).toBe('Ventes_Kouassi-Jean_Eau-1-5-L_2026-10-01_au_2026-10-31');
    const html = genererHtmlEtat(doc);
    expect(html).toContain('<div>Client : <b>Kouassi Jean</b></div>');
    expect(html).toContain('<div>Produit : <b>Eau 1,5 L</b></div>');
  });

  it('filtre produit : note « Montants limités au produit X » par livraison et par client', () => {
    const doc = documentVentes(calculerEtatVentes(livraisons, P), { ...entete, filtres });
    const notes = doc.sections.map((s) => s.note);
    expect(notes).toEqual([
      'Montants limités au produit Eau 1,5 L',
      'Montants limités au produit Eau 1,5 L',
      undefined,
    ]);
  });

  it('sans filtre : aucune ligne, nom du livreur ; vue équipe : « Equipe »', () => {
    const doc = documentVentes(calculerEtatVentes(livraisons, P), entete);
    expect(doc.filtres).toEqual([]);
    expect(doc.nomFichier).toBe('Ventes_Awa-Kone_2026-10-01_au_2026-10-31');
    expect(doc.sections[0].note).toBeUndefined();
    const equipe = documentStock(calculerEtatStock([], [], P), {
      ...entete,
      livreur: 'Équipe de Awa Kone',
      equipe: true,
    });
    expect(equipe.nomFichier).toBe('Stock-Mouvements_Equipe_2026-10-01_au_2026-10-31');
  });

  it('le type de mouvement figure dans l’en-tête mais pas dans le nom du fichier', () => {
    const doc = documentStock(calculerEtatStock([], [], P), {
      ...entete,
      filtres: { client: null, produit: null, fournisseur: null, typeMouvement: { id: 'RETOUR_EN_STOCK', label: 'Retour en stock' } },
    });
    expect(doc.filtres).toEqual([{ libelle: 'Type de mouvement', valeur: 'Retour en stock' }]);
    expect(doc.nomFichier).toBe('Stock-Mouvements_Awa-Kone_2026-10-01_au_2026-10-31');
  });
});
