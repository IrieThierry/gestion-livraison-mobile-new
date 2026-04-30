import { z } from 'zod';

// Port de gestion-livraison-front/src/features/livraisons/schemas.ts.
// Convention projet : `.min(1)` plutôt que `.uuid()` pour les IDs (les UUIDs
// renvoyés par le backend ne respectent pas toujours le format strict v4).
export const ligneProduitSchema = z.object({
  produitId: z.string().min(1, 'Produit requis'),
  qteLivree: z.coerce.number().int().min(1, 'Min 1'),
  qteRetournee: z.coerce.number().int().min(0).default(0),
  prixDeVente: z.coerce.number().min(0),
});

export const livraisonSchema = z.object({
  livreurId: z.string().min(1, 'Livreur requis'),
  clientId: z.string().min(1, 'Client requis'),
  avecRemise: z.boolean().default(false),
  produitsLivraison: z.array(ligneProduitSchema).min(1, 'Au moins un produit'),
});

export type LivraisonForm = z.infer<typeof livraisonSchema>;
export type LigneProduitForm = z.infer<typeof ligneProduitSchema>;

// Schéma encaissement (mirroir du payload `CreerEncaissementLivraisonRequest`).
// Le portail web ne définit pas ce schéma (formulaire piloté par useState côté
// pages/EncaisserPage), on le matérialise ici pour le formulaire mobile.
export const encaisserLivraisonSchema = z.object({
  livreurId: z.string().min(1, 'Livreur requis'),
  clientId: z.string().min(1, 'Client requis'),
  livraisonIds: z.array(z.string().min(1)).min(1, 'Au moins une livraison'),
  montantEncaisse: z.coerce.number().min(1, 'Montant requis'),
  commentaire: z.string().default(''),
});

export type EncaisserLivraisonForm = z.infer<typeof encaisserLivraisonSchema>;
