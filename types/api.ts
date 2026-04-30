// Types alignés sur les DTO Java du back (field names en français conservés).

export type UUID = string
export type ISODate = string // format ISO renvoyé par le back

// ---------- Auth ----------
export interface LoginRequest {
  username: string
  password: string
}

// Statut métier du compte. `EN_ATTENTE_VALIDATION` = login OK mais toutes
// les actions métier sont bloquées tant qu'un admin n'a pas validé. Le seul
// écran accessible reste le profil (pour changer son mot de passe).
export type StatutCompte = 'VALIDE' | 'EN_ATTENTE_VALIDATION'

export interface AuthResponse {
  token: string
  id: UUID
  nom: string
  prenom: string
  username: string
  role: 'ADMIN' | 'LIVREUR'
  email: string
  contact: string
  // Optionnel pour rester compatible avec les anciennes sessions persistées
  // dans AsyncStorage (avant l'ajout du champ côté back).
  statut?: StatutCompte
  // `null` = livreur racine (peut avoir des apprentis). UUID = apprenti
  // rattaché à ce parent. Optionnel pour rester compatible avec les
  // sessions persistées avant l'exposition de la feature apprenti.
  parentId?: UUID | null
  // `false` = compte désactivé par admin / parent (login refusé). Optionnel
  // pour back-compat.
  actif?: boolean
}

/**
 * Payload de création d'un apprenti (= livreur rattaché à un parent root).
 * Mirror de `CreerApprentiPayload` côté web. Le back accepte `parentId`
 * directement (en plus de `parent: { id }` via `CreerLivreurRequest`).
 */
export interface CreerApprentiRequest {
  nom: string
  prenom: string
  contact: string
  email: string
  username: string
  password: string
  role: 'LIVREUR'
  parentId: UUID
}

// ---------- Lookups ----------
export interface ZoneResponse {
  id: UUID
  libelle: string
}

export interface QuartierResponse {
  id: UUID
  libelle: string
  zone: ZoneResponse
}

export interface CategorieResponse {
  id: UUID
  libelle: string
}

export interface CreerZoneRequest {
  libelle: string
}

export interface ModifierZoneRequest {
  id: UUID
  libelle: string
}

export interface CreerCategorieRequest {
  libelle: string
}

export interface ModifierCategorieRequest {
  id: UUID
  libelle: string
}

export interface CreerQuartierRequest {
  libelle: string
  zoneId: UUID
}

export interface ModifierQuartierRequest {
  id: UUID
  libelle: string
  zoneId: UUID
}

export interface LivreurResponse {
  id: UUID
  nom: string
  prenom: string
  contact: string
  email: string
  username: string
  role: 'ADMIN' | 'LIVREUR'
  parent: LivreurResponse | null
  // Optional pour back-compat avec les payloads pré-existants. Le back
  // renvoie ces champs sur les endpoints `/livreur/parent/{id}` et
  // similaires (cf. `User` type côté web).
  actif?: boolean
  statut?: StatutCompte
}

export interface CreerLivreurRequest {
  nom: string
  prenom: string
  contact: string
  email: string
  username: string
  password: string
  role: 'ADMIN' | 'LIVREUR'
  parent: { id: UUID } | null
}

export interface ModifierLivreurRequest {
  id: UUID
  nom: string
  prenom: string
  contact: string
  email: string
  username: string
  password: string
  role: 'ADMIN' | 'LIVREUR'
  parent: UUID | null
}

export interface ProduitResponse {
  id: UUID
  code: string
  designation: string
  prixAchatParDefaut: number
  statut?: string
}

export interface CreerProduitRequest {
  designation: string
  prixAchatParDefaut: number
}

export interface ModifierProduitRequest {
  id: UUID
  designation: string
  prixAchatParDefaut: number
}

// ---------- Clients ----------
export interface ClientResponse {
  id: UUID
  nom: string
  prenom: string
  contact: string
  email: string
  latitudeLongitude: string
  adresse: string
  quartier: QuartierResponse
  categorie: CategorieResponse
  livreur?: LivreurResponse
  prixDeVenteProduitParDefault: number
  avecOuSansRemise: boolean
}

export interface CreerClientRequest {
  nom: string
  prenom: string
  contact: string
  email: string
  latitudeLongitude: string
  adresse: string
  quartierId: UUID
  categorieId: UUID
  livreurId: UUID
  prixDeVenteProduitParDefault: number
  avecOuSansRemise: boolean
}

export interface ModifierClientRequest extends CreerClientRequest {
  id: UUID
}

export interface ProduitClientResponse {
  produit: ProduitResponse
  prixDeVente: number
}

// ---------- Livraisons ----------
export type StatutLivraison = 'LIVREE' | 'ENCAISSEE'

export interface ProduitLivraisonRequest {
  produitId: UUID
  qteLivree: number
  qteRetournee: number
  prixDeVente: number
}

export interface ProduitLivraisonResponse {
  id: UUID
  produit: ProduitResponse
  qteLivre: number
  qteRetourne: number
  prixDeVente: number
  /** Marge cristallisée à la livraison (Plan D) — preferred for marge calculations. */
  margeUnitaire: number
}

export interface LivraisonResponse {
  id: UUID
  reference: string
  client: ClientResponse
  livreur: LivreurResponse
  date: ISODate
  produitsLivraison: ProduitLivraisonResponse[]
  statut: StatutLivraison
  montantLivre: number
  avecRemise: boolean
}

export interface CreerLivraisonRequest {
  livreurId: UUID
  clientId: UUID
  produitsLivraison: ProduitLivraisonRequest[]
  avecRemise: boolean
}

export interface ModifierLivraisonRequest extends CreerLivraisonRequest {
  id: UUID
}

// ---------- Encaissements (v2 — paiement libre sur plage avec dette cumulative) ----------
export interface CreerEncaissementLivraisonRequest {
  livreurId: UUID
  clientId: UUID
  dateDebut?: string         // YYYY-MM-DD — optionnel si libre=true
  dateFin?: string           // YYYY-MM-DD — optionnel si libre=true
  dateEncaissement?: string  // YYYY-MM-DD
  montantEncaisse: number
  commentaire?: string
  /** Mode libre : solder la dette sans plage (valeurLivraisons=0). */
  libre?: boolean
}

export interface EncaissementLivraisonResponse {
  reference: string
  montantEncaisse: number
  livreur: LivreurResponse
  client: ClientResponse
  livraisons: LivraisonResponse[]
  commentaire: string
  date: ISODate
}

// ---------- Dashboard ----------
export interface DashboardStatsResponse {
  totalClients: number
  totalLivreurs: number
  totalProduits: number
  totalFournisseurs: number
  totalLivraisons: number
  totalCommandes: number
  livraisonsLivrees: number
  livraisonsEncaissees: number
  totalMontantLivraisons: number
  totalEncaissementsLivraison: number
  montantLivraisonsPeriode: number
  livraisonsParJour: Array<Record<string, unknown>>
  topLivreurs: Array<Record<string, unknown>>
  topClients: Array<Record<string, unknown>>
  [key: string]: unknown
}

// ---------- Fournisseur ----------
export interface FournisseurResponse {
  id: UUID
  code: string
  libelle: string
  interlocuteur: string
  contact: string
}

export interface CreerFournisseurRequest {
  libelle: string
  interlocuteur: string
  contact: string
  livreurId: UUID
}

export interface ModifierFournisseurRequest {
  fournisseurId: UUID
  libelle: string
  interlocuteur: string
  contact: string
}

// ---------- Commandes ----------
export type StatutCommande = 'ENVOYEE' | 'ENCAISSEE'

export interface ProduitCommandeRequest {
  produitId: UUID
  qteCommandee: number
  prixAchat: number
}

export interface ProduitCommandeResponse {
  id: UUID
  produit: ProduitResponse
  qteCommandee: number
  prixAchat: number
}

export interface CommandeResponse {
  id: UUID
  reference: string
  livreur: LivreurResponse
  fournisseur: FournisseurResponse
  montantCommande: number
  date: ISODate
  produitsCommandes: ProduitCommandeResponse[]
  statut: StatutCommande
}

export interface CreerCommandeRequest {
  fournisseurId: UUID
  livreurId: UUID
  produitsCommandes: ProduitCommandeRequest[]
}

// ---------- Stock / Achats (Plan D — split achat / stock_courant_livreur) ----------

/**
 * Une ligne du stock courant agrégée par produit (sommée sur tous les achats
 * du livreur, déduite des livraisons enregistrées).
 * Source : `GET /stock-livreur/me/courant`.
 */
export interface StockCourantLigneResponse {
  produit: ProduitResponse
  qteVendable: number
  qteRetourneeSurPeriode: number
}

/**
 * Une ligne d'achat (= un événement d'approvisionnement chez un fournisseur).
 * Source : `GET /stock-livreur/{livreurId}/actuel` renvoie la liste des
 * achats encore présents en stock pour un livreur, ventilés par produit ET
 * par fournisseur.
 */
export interface AchatResponse {
  id: UUID
  livreur: LivreurResponse
  produit: ProduitResponse
  qte: number
  dateEnregistrement: ISODate
  fournisseur: FournisseurResponse | null
  prixVersement: number | null
  prixVente: number | null
  coutTotal: number
  valeurVenteTotal: number | null
}

/** @deprecated Alias historique de `AchatResponse` — conservé par parité avec le web. */
export type StockLivreurResponse = AchatResponse

/**
 * Une ligne du payload de déclaration d'achat (= entrée de stock chez un
 * fournisseur). Mirror de `LigneStockRequest` côté web/back — pas de prix
 * d'achat sur la ligne, le prix vient du `produit.prixAchatParDefaut` côté
 * back.
 */
export interface LigneStockRequest {
  produitId: UUID
  qte: number
}

/**
 * Payload de `POST /stock-livreur` — un livreur déclare avoir embarqué N
 * lignes de stock chez un fournisseur. Renvoie la liste des `StockLivreurResponse`
 * (= achats) créés.
 */
export interface EnregistrerStockRequest {
  livreurId: UUID
  fournisseurId: UUID
  lignes: LigneStockRequest[]
}

// ---------- Dépenses (Plan 24) ----------
export type DepenseCategorie = 'CARBURANT' | 'ENTRETIEN' | 'ADMINISTRATIF' | 'AUTRE'

export interface DepenseResponse {
  id: UUID
  libelle: string
  categorie: string
  montant: number
  dateDepense: string  // YYYY-MM-DD
  commentaire: string | null
}

export interface CreerDepenseRequest {
  libelle: string
  categorie: string
  montant: number
  dateDepense: string  // YYYY-MM-DD
  commentaire?: string
}

export interface ModifierDepenseRequest {
  libelle?: string
  categorie?: string
  montant?: number
  dateDepense?: string
  commentaire?: string
}

// ---------- Transferts stock (Plan 23) ----------
export interface TransfertStockResponse {
  id: UUID
  source: LivreurResponse
  destinataire: LivreurResponse
  produit: ProduitResponse
  qte: number
  dateTransfert: ISODate
  commentaire: string | null
}

export interface EffectuerTransfertRequest {
  sourceId: UUID
  destinataireId: UUID
  produitId: UUID
  qte: number
  commentaire?: string
}

// ---------- Prévisions (Plan 22) ----------
export interface PrevisionResponse {
  id: UUID
  livreur: LivreurResponse
  client: ClientResponse
  produit: ProduitResponse
  qteEstimee: number
  dateLivraison: string  // YYYY-MM-DD
  commentaire: string | null
}

export interface CreerPrevisionRequest {
  livreurId: UUID
  clientId: UUID
  produitId: UUID
  qteEstimee: number
  dateLivraison: string
  commentaire?: string
}

export interface ModifierPrevisionRequest {
  qteEstimee?: number
  dateLivraison?: string
  commentaire?: string
}

export interface CumulProduitResponse {
  produit: ProduitResponse
  qteCumulee: number
}

// ---------- Clôture journalière (Plan 13) ----------
export interface ClotureJournaliereResponse {
  id: UUID
  livreur: LivreurResponse | null
  dateCloture: ISODate
  totalLivre: number
  totalEncaisse: number
  montantRemis: number
  ecartEspeces: number
  commentaire: string
  dateEnregistrement: ISODate
}

export interface EnregistrerClotureRequest {
  livreurId: UUID
  dateCloture: ISODate
  montantRemis: number
  commentaire: string
}

// ---------- Reversements (Item A) ----------
export type BeneficiaireType = 'CLIENT' | 'FOURNISSEUR'

export interface ReversementRecord {
  id: UUID
  type: BeneficiaireType
  beneficiaireId: UUID
  montant: number
  periodeMois: number
  periodeAnnee: number
  dateReversement: string
  commentaire: string | null
}

export interface EnregistrerReversementRequest {
  type: BeneficiaireType
  beneficiaireId: UUID
  montant: number
  mois: number
  annee: number
  dateReversement?: string
  commentaire?: string
}

export interface LigneFournisseurDuResponse {
  fournisseurId: UUID
  libelle: string
  margeCumuleeMois: number
  detteCourante: number
  montantNetDu: number
}

export interface LigneClientDuResponse {
  clientId: UUID
  prenom: string
  nom: string
  margeDue: number
}

export interface ReversementsSyntheseLivreurResponse {
  annee: number
  mois: number
  mesFournisseursMeDoivent: LigneFournisseurDuResponse[]
  jeDoisAMesClients: LigneClientDuResponse[]
}

// ---------- Pricing livreur/client (Plan A) ----------
export interface PrixLivreurProduitResponse {
  id: UUID
  produit: ProduitResponse
  prix: number
}
export interface UpsertPrixLivreurRequest {
  produitId: UUID
  prix: number
}
export interface PrixClientProduitResponse {
  id: UUID
  produit: ProduitResponse
  prix: number
}
export interface UpsertPrixClientRequest {
  clientId: UUID
  produitId: UUID
  prix: number
}

// ---------- Prix résolu (Plan D — résolveur) ----------
/**
 * Réponse de `GET /prix/resoudre?clientId=X&produitId=Y` — donne le prix
 * unitaire à appliquer pour un (client, produit), avec la source utilisée
 * pour la résolution.
 *
 *   - `source = 'CLIENT'` → prix custom enregistré pour ce couple
 *   - `source = 'LIVREUR'` → prix par défaut du livreur connecté
 *   - `source = null` (et `prix = null`) → aucun prix mémorisé, le
 *     livreur doit taper le prix manuellement (fallback sur
 *     `client.prixDeVenteProduitParDefault` ou `produit.prixAchatParDefaut`)
 */
export interface ResoudrePrixResponse {
  prix: number | null
  source: 'CLIENT' | 'LIVREUR' | null
}

// ---------- Encaissements commandes ----------
export interface CreerEncaissementCommandeRequest {
  montantEncaisse: number
  livreurId: UUID
  fournisseurId: UUID
  commentaire: string
  commandeIds: UUID[]
}

export interface EncaissementCommandeResponse {
  reference: string
  montantEncaisse: number
  livreur: LivreurResponse
  fournisseur: FournisseurResponse
  commandes: CommandeResponse[]
  commentaire: string
  date: ISODate
}

// ---------- Versements (Plan 20 / Versement v2) ----------
// Mirror de gestion-livraison-front/src/types/api.ts.
export interface VersementResponse {
  id: UUID
  livreur: LivreurResponse
  fournisseur: FournisseurResponse
  dateDebut: string
  dateFin: string
  dateVersement: string
  valeurAchat: number
  margeCumulee: number
  montantVerse: number
  detteAvant: number
  detteApres: number
  commentaire: string | null
  statutContestation: 'NONE' | 'CONTESTE' | 'RESOLU'
  motifContestation: string | null
  contesteLe: string | null
}

export interface CreerVersementRequest {
  livreurId: UUID
  fournisseurId: UUID
  dateDebut?: string
  dateFin?: string
  dateVersement?: string
  montantVerse: number
  commentaire?: string
  /** Mode libre : solder la dette sans plage (valeurAchat=0). */
  libre?: boolean
}

export interface SituationVersementResponse {
  valeurAchat: number
  margeCumulee: number
  detteAvant: number
  totalDu: number // = detteAvant + valeurAchat
}
