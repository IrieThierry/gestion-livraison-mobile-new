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
});
