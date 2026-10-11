import {
  AUCUN_FILTRE,
  entitesFichier,
  filtresDeFamille,
  idsFiltres,
  lignesFiltres,
  OPTIONS_TYPES_MOUVEMENT,
  optionsEncaissements,
  optionsFournisseurs,
  optionsStock,
  optionsVentes,
} from './filtres';
import {
  commande,
  encaissement,
  encours,
  ligneLivraison,
  livraison,
  mouvement,
  partenaire,
  versement,
} from './calculs/etats.fixture';

describe('options des filtres', () => {
  it('ventes : clients et produits uniques, triés', () => {
    const o = optionsVentes([
      livraison({ id: '1', date: '2026-10-01', clientId: 'c2', client: 'Zoé Kone', montantDu: 0, lignes: [ligneLivraison('p2', 'Jus', 1, 0, 1)] }),
      livraison({ id: '2', date: '2026-10-01', clientId: 'c1', client: 'Ali Traore', montantDu: 0, lignes: [ligneLivraison('p1', 'Eau', 1, 0, 1), ligneLivraison('p2', 'Jus', 1, 0, 1)] }),
      livraison({ id: '3', date: '2026-10-02', clientId: 'c1', client: 'Ali Traore', montantDu: 0 }),
    ]);
    expect(o.clients).toEqual([
      { id: 'c1', label: 'Ali Traore' },
      { id: 'c2', label: 'Zoé Kone' },
    ]);
    expect(o.produits).toEqual([
      { id: 'p1', label: 'Eau' },
      { id: 'p2', label: 'Jus' },
    ]);
  });

  it('encaissements : clients des encaissements et des soldes', () => {
    const o = optionsEncaissements(
      [encaissement({ id: 'e', date: '2026-10-01', client: 'Ali Traore', montant: 1 })],
      [encours('c-x', 'Binta Diallo', 10)],
    );
    expect(o.clients?.map((c) => c.label)).toEqual(['Ali Traore', 'Binta Diallo']);
  });

  it('stock : produits et les six types de mouvement', () => {
    const o = optionsStock([{ produit: { id: 'p-Jus', designation: 'Jus' }, qte: 1 }], [mouvement('LIVRAISON', '2026-10-01', -1)]);
    expect(o.produits?.map((p) => p.label)).toEqual(['Eau 1,5 L', 'Jus']);
    expect(OPTIONS_TYPES_MOUVEMENT.map((t) => t.label)).toEqual([
      'Réception',
      'Livraison',
      'Retour produit',
      'Transfert entrée',
      'Transfert sortie',
      'Ajustement',
    ]);
    expect(o.typesMouvement).toBe(OPTIONS_TYPES_MOUVEMENT);
  });

  it('fournisseurs : partenaires acceptés, commandes et versements', () => {
    const o = optionsFournisseurs(
      [partenaire('f1', 'Brasserie', 0, 0), partenaire('f9', 'En attente', 0, 0, 'EN_ATTENTE')],
      [commande({ id: 'k', date: '2026-10-01', fournisseurId: 'f2', fournisseur: 'Laiterie' })],
      [versement({ id: 'v', date: '2026-10-01', fournisseurId: 'f1', fournisseur: 'Brasserie', montant: 1 })],
    );
    expect(o.fournisseurs).toEqual([
      { id: 'f1', label: 'Brasserie' },
      { id: 'f2', label: 'Laiterie' },
    ]);
  });
});

describe('choix des filtres', () => {
  const tous = {
    client: { id: 'c', label: 'Ali' },
    produit: { id: 'p', label: 'Eau' },
    fournisseur: { id: 'f', label: 'Brasserie' },
    typeMouvement: { id: 'AJUSTEMENT', label: 'Ajustement' },
  };

  it('ne garde que les filtres de la famille', () => {
    expect(filtresDeFamille('ventes', tous)).toEqual({ ...AUCUN_FILTRE, client: tous.client, produit: tous.produit });
    expect(filtresDeFamille('encaissements', tous)).toEqual({ ...AUCUN_FILTRE, client: tous.client });
    expect(filtresDeFamille('stock', tous)).toEqual({ ...AUCUN_FILTRE, produit: tous.produit, typeMouvement: tous.typeMouvement });
    expect(filtresDeFamille('fournisseurs', tous)).toEqual({ ...AUCUN_FILTRE, fournisseur: tous.fournisseur });
  });

  it('identifiants, lignes d’en-tête et entités du nom de fichier', () => {
    expect(idsFiltres(tous)).toEqual({ clientId: 'c', produitId: 'p', fournisseurId: 'f', typeMouvement: 'AJUSTEMENT' });
    expect(idsFiltres(AUCUN_FILTRE)).toEqual({ clientId: null, produitId: null, fournisseurId: null, typeMouvement: null });
    expect(lignesFiltres(tous).map((l) => `${l.libelle} : ${l.valeur}`)).toEqual([
      'Client : Ali',
      'Produit : Eau',
      'Fournisseur : Brasserie',
      'Type de mouvement : Ajustement',
    ]);
    expect(entitesFichier(tous)).toEqual(['Ali', 'Eau', 'Brasserie']);
  });
});
