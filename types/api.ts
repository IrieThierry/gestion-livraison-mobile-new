// Types alignés sur les DTO Java du back (field names en français conservés).

export type UUID = string
export type ISODate = string // format ISO renvoyé par le back

// ---------- Auth ----------
export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  token: string
  id: UUID
  nom: string
  prenom: string
  username: string
  role: 'ADMIN' | 'LIVREUR'
  email: string
  contact: string
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

// ---------- Encaissements ----------
export interface CreerEncaissementLivraisonRequest {
  montantEncaisse: number
  livreurId: UUID
  livraisonIds: UUID[]
  clientId: UUID
  commentaire: string
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
