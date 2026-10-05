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
  /**
   * JWT de refresh, durée de vie longue (~7 jours). Permet à l'interceptor
   * axios d'obtenir un nouvel `access_token` sans demander à l'utilisateur
   * de se relogger quand le token court (~15 min) expire.
   */
  refreshToken: string
  id: UUID
  nom: string
  prenom: string
  username: string
  /** Profil métier renvoyé par le back (ex. 'LIVREUR', 'ADMIN', 'FOURNISSEUR'). */
  profile?: string
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
  // URL absolue ou relative de la photo de profil. `null` ou `undefined`
  // signifie qu'aucune photo n'est définie (fallback initiales).
  photoUrl?: string | null
}

export interface PhotoUploadResponse {
  photoUrl: string
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
  profile?: string
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
  profile: string
  parentId?: UUID | null
  photoUrl?: string | null
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
  profile?: string
  parent?: { id: UUID } | null
  parentId?: UUID
}

export interface ModifierLivreurRequest {
  id: UUID
  nom: string
  prenom: string
  contact: string
  email: string
  username: string
  password: string
  profile?: string
  parent: UUID | null
}

export interface ProduitResponse {
  id: UUID
  code: string
  designation: string
  /** Renseigné quand le produit a été créé par un fournisseur. */
  creeParFournisseurId?: UUID | null
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
  /** Null pour un client créé sans prix par défaut (ex. par un apprenti). */
  prixDeVenteProduitParDefault: number | null
  avecOuSansRemise: boolean
  limiteCredit: number | null
  margeParUnite: number | null
  photoUrl?: string | null
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
  /** Omis à la création : le client n'a pas de prix par défaut (null). */
  prixDeVenteProduitParDefault?: number
  avecOuSansRemise: boolean
  /** Optionnel ; sans effet sur les remises (D7). */
  margeParUnite?: number
  /** Optionnel ; conservé côté back quand absent à la modification. */
  limiteCredit?: number
}

export interface ModifierClientRequest
  extends Omit<CreerClientRequest, 'prixDeVenteProduitParDefault' | 'avecOuSansRemise'> {
  id: UUID
  /** Omis pour un apprenti (D20) : le back garde le statut stocké. */
  avecOuSansRemise?: boolean
  /** Optionnel à la modification : absent, le back garde la valeur stockée. */
  prixDeVenteProduitParDefault?: number
}

export interface ProduitClientResponse {
  produit: ProduitResponse
  prixDeVente: number
}

// ---------- Livraisons ----------
/**
 * Statut métier de la livraison (DB column). En pratique, le back ne le
 * fait jamais transiter de LIVREE → ENCAISSEE — il reste figé à LIVREE
 * dès la création. Le vrai indicateur d'encaissement est calculé à la
 * volée et exposé via `statutEncaissement` ci-dessous.
 */
export type StatutLivraison = 'LIVREE' | 'ENCAISSEE'

/**
 * Statut d'encaissement calculé par le back :
 *   - `ENCAISSEE`     — livraison entièrement payée
 *   - `NON_ENCAISSEE` — reste un dû
 *
 * **C'est ce champ qu'il faut afficher au livreur**, pas `statut`.
 */
export type StatutEncaissement = 'ENCAISSEE' | 'NON_ENCAISSEE'

export interface ProduitLivraisonRequest {
  produitId: UUID
  qteLivree: number
  qteRetournee: number
  prixDeVente: number
  /** Mémorise le prix pour ce client. */
  memoriserPrixClient?: boolean
  /** Quantité retournée remise en stock (le reste est perdu). */
  qteRetourneeEnStock?: number
  /** Remise unitaire convenue (saisie ; mémorisée par (client, produit)). */
  remiseUnitaire?: number
}

export interface ProduitLivraisonResponse {
  id: UUID
  produit: ProduitResponse
  qteLivre: number
  qteRetourne: number
  prixDeVente: number
  /** Marge cristallisée à la livraison (Plan D) — preferred for marge calculations. */
  margeUnitaire: number
  qteRetourneeEnStock: number
  remiseUnitaire: number
}

export interface LivraisonResponse {
  id: UUID
  reference: string
  client: ClientResponse
  livreur: LivreurResponse
  date: ISODate
  produitsLivraison: ProduitLivraisonResponse[]
  /** Statut métier figé en base (toujours `LIVREE` en pratique). */
  statut: StatutLivraison
  /**
   * Statut d'encaissement calculé à la volée par le back. Optionnel pour
   * back-compat (les sessions/responses pré-Plan-D peuvent ne pas le
   * renvoyer) — fallback à `NON_ENCAISSEE` côté front.
   */
  statutEncaissement?: StatutEncaissement
  /** Calculé par le back (D16) : payée avec dû > 0, ou gel après retour total. Seuls les retours restent possibles. */
  figee?: boolean
  montantLivre: number
  /** Dû net (avant paiements) calculé par le back : (prix + remise) × (livré − retourné). */
  montantDu: number
  /** Remise nette calculée par le back. */
  remiseNette: number
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
  dateDebut?: string         // LocalDateTime ISO — ignoré si libre=true
  dateFin?: string           // LocalDateTime ISO — ignoré si libre=true
  dateEncaissement?: string  // LocalDateTime ISO — absent = maintenant (serveur)
  montantEncaisse: number
  commentaire?: string
  /** Mode libre : solder la dette sans plage (valeurLivraisons=0). */
  libre?: boolean
}

export interface EncaissementLivraisonResponse {
  id: UUID
  reference: string
  livreur: LivreurResponse
  client: ClientResponse
  dateDebut: string | null
  dateFin: string | null
  dateEncaissement: ISODate
  valeurLivraisons: number
  margeCumulee: number
  montantEncaisse: number
  detteAvant: number
  detteApres: number
  commentaire: string | null
}

export interface SituationEncaissementResponse {
  valeurLivraisons: number
  margeCumulee: number
  detteAvant: number
  totalDu: number
}

export interface EncoursClientResponse {
  clientId: UUID
  nomClient: string
  limiteCredit: number | null
  totalLivre: number
  totalRetour: number
  totalEncaisse: number
  solde: number
  enDepassement: boolean
  totalRemise: number
}

export interface MargeCumuleeResponse {
  margeBrute: number
  margeRetours: number
  margeReversee: number
  margeDue: number
  remiseEnAttente: number
}

// ---------- Remises convenues par (client, produit) ----------
export interface RemiseClientProduitResponse {
  id: UUID
  produit: ProduitResponse
  remiseUnitaire: number
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

// ---------- Commandes (livreur -> fournisseur) ----------
export type StatutCommande = 'ENVOYEE' | 'CONFIRMEE' | 'REFUSEE' | 'ANNULEE' | 'LIVREE'

export interface ProduitCommandeResponse {
  id: UUID
  produit: ProduitResponse
  qteCommandee: number
  qteLivree: number | null     // renseignée à la livraison par le fournisseur
  prixUnitaire: number | null  // figé à la livraison
  remiseLivreurUnitaire: number | null // figée à la livraison
}

export interface CommandeResponse {
  id: UUID
  reference: string
  livreur: LivreurResponse
  fournisseur: FournisseurResponse
  statut: StatutCommande
  date: string                 // ISO — date de la commande
  dateDecision: string | null  // ISO — confirmation ou refus
  motifRefus: string | null
  dateLivraison: string | null // ISO
  montantLivre: number | null  // Σ qteLivree × prixUnitaire (statut LIVREE)
  remiseLivreurLivree: number | null
  versementId: UUID | null     // non nul = réglée par un versement
  produitsCommandes: ProduitCommandeResponse[]
}

export interface CreerCommandeRequest {
  fournisseurId: UUID
  produitsCommandes: Array<{ produitId: UUID; qteCommandee: number }>
}

/** Ligne du catalogue d'un fournisseur (GET /produit-fournisseur?fournisseurId=). */
export interface ProduitFournisseurResponse {
  id: UUID
  produit: ProduitResponse
  fournisseur: FournisseurResponse
  prixDeVente: number
  /** Remise livreur par unité (valeur résolue pour le livreur connecté). */
  remiseLivreur: number
  actif: boolean
  dateDesactivation?: string | null
  /** Vrai si les valeurs sont celles d'un prix particulier accordé à ce livreur. */
  prixParticulier: boolean
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
 * Stock courant agrégé de l'équipe (root + apprentis) — une ligne par tuple
 * (produit × fournisseur), avec ventilation `parLivreur`. Source :
 * `GET /stock-livreur/equipe`. Mirror de `StockEquipeLigneResponse` côté web.
 */
export interface StockEquipeLigneResponse {
  produit: ProduitResponse
  fournisseur: FournisseurResponse
  parLivreur: { livreurId: UUID; prenom: string; nom: string; qte: number }[]
  totalQte: number
  prixVersement: number | null
  prixVente: number | null
  coutTotal: number
  valeurVenteTotal: number | null
}

/**
 * Une ligne du payload de déclaration d'achat (= entrée de stock chez un
 * fournisseur). Mirror de `LigneStockRequest` côté web/back — pas de prix
 * d'achat sur la ligne (le back lit le catalogue actif du fournisseur).
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
  /** LocalDateTime : le back ramène au début du jour. */
  dateCloture: ISODate
  /** ≥ 0. Écart (back) = totalEncaisse − montantRemis ; positif = manque en caisse. */
  montantRemis: number
  commentaire?: string
}

// ---------- Reversements (Item A) ----------
export type BeneficiaireType = 'CLIENT' | 'FOURNISSEUR'

export interface ReversementRecord {
  id: UUID
  type: BeneficiaireType
  beneficiaireId: UUID
  /** Livreur propriétaire ; null pour les reversements antérieurs au lot 3. */
  livreurId: UUID | null
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
  /** Période (mois civil) : jamais un mois à venir (refus du back). */
  mois: number
  annee: number
  /** LocalDateTime, jamais dans le futur ; absent = aujourd'hui (serveur). */
  dateReversement?: string
  commentaire?: string
}

export interface LigneFournisseurDuResponse {
  fournisseurId: UUID
  libelle: string
  remiseLivreurCumuleeMois: number
  detteCourante: number
  montantNetDu: number
}

export interface LigneClientDuResponse {
  clientId: UUID
  prenom: string
  nom: string
  margeDue: number
  livreurId: UUID
  remiseAcquise: number
  remiseReversee: number
  resteAReverser: number
  remiseEnAttente: number
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
 *     livreur doit taper le prix manuellement (repli sur
 *     `client.prixDeVenteProduitParDefault`, sinon prix laissé à saisir)
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
  remiseLivreurCumulee: number
  montantVerse: number
  detteAvant: number
  detteApres: number
  commentaire: string | null
}

export interface CreerVersementRequest {
  livreurId: UUID
  fournisseurId: UUID
  /** Commandes réglées ; vide ou absent = versement libre (réduit seulement la dette, montant > 0). */
  commandeIds?: UUID[]
  dateVersement?: string
  montantVerse: number
  commentaire?: string
}

export interface SituationVersementResponse {
  valeurAchat: number      // Σ montant livré des commandes sélectionnées
  remiseLivreurCumulee: number // Σ remise livreur livrée des commandes sélectionnées
  detteAvant: number       // dette du dernier versement créé
  totalDu: number          // = detteAvant + valeurAchat
  dateDebut: string | null // plus ancienne livraison sélectionnée (nulle si aucune commande)
  dateFin: string | null   // plus récente livraison sélectionnée
  nbCommandes: number
}

export interface UpsertRemiseClientRequest {
  clientId: UUID
  produitId: UUID
  /** BigDecimal >= 0, 2 décimales maximum. */
  remiseUnitaire: number
}
