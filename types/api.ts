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
  /** D21 : remise unitaire (F) du client, identique pour tous les produits ; 0 par défaut, jamais null. */
  remiseUnitaire: number
  /** @deprecated Limite de crédit abandonnée (tous les clients sont sans limite). */
  limiteCredit?: number | null
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
  /** @deprecated Plus saisi à l'enrôlement : ne jamais envoyer. */
  prixDeVenteProduitParDefault?: number
  avecOuSansRemise: boolean
  /** D21 : remise unitaire du client (>= 0, 2 décimales max) ; envoyée par la racine/admin seulement, absente = 0 (création) / valeur stockée (modification). */
  remiseUnitaire?: number
  /** Optionnel ; sans effet sur les remises (D7). */
  margeParUnite?: number
  /** @deprecated Abandonnée : ne jamais envoyer (le back garde la valeur stockée / défaut). */
  limiteCredit?: number
}

export interface ModifierClientRequest
  extends Omit<CreerClientRequest, 'prixDeVenteProduitParDefault' | 'avecOuSansRemise'> {
  id: UUID
  /** Omis pour un apprenti (D20) : le back garde le statut stocké. */
  avecOuSansRemise?: boolean
  /** @deprecated Ne jamais envoyer : le back garde la valeur stockée. */
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
 *   - `ENCAISSEE`     — un encaissement la vise ou elle a reçu un paiement,
 *                       même partiel (E8) : un reste dû est possible ;
 *   - `NON_ENCAISSEE` — aucun paiement ni encaissement.
 *
 * **C'est ce champ qu'il faut afficher au livreur**, pas `statut`, suivi du
 * reste dû. « Entièrement payée » se lit sur `entierementPayee` / `resteDu`.
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
  /** Montant payé rejoué par le back (E9). */
  montantPaye: number
  /** Reste dû = `montantDu` − `montantPaye` (serveur). */
  resteDu: number
  /** Vrai quand le reste dû est nul : seule source de « entièrement payée ». */
  entierementPayee: boolean
  /** Références des encaissements qui visent cette livraison. */
  encaissementReferences: string[]
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

// ---------- Encaissements (par livraisons cochées, E1 / E4 / E10) ----------
export interface CreerEncaissementLivraisonRequest {
  livreurId: UUID
  clientId: UUID
  /** Livraisons du client couvertes, des plus anciennes aux plus récentes. */
  livraisonIds: UUID[]
  montantEncaisse: number
  dateEncaissement?: string  // LocalDateTime ISO — absent = maintenant (serveur)
  commentaire?: string
}

export interface ModifierEncaissementLivraisonRequest {
  encaissementLivraisonId: UUID
  livraisonIds: UUID[]
  montantEncaisse: number
  dateEncaissement?: string  // absent = inchangée
  commentaire?: string
}

/** Livraison rattachée à un encaissement (compte actuel). */
export interface LivraisonEncaisseeResponse {
  livraisonId: UUID
  reference: string
  date: ISODate
  part: number
  resteDu: number
  statutEncaissement: StatutEncaissement
}

export interface EncaissementLivraisonResponse {
  id: UUID
  reference: string
  livreur: LivreurResponse
  client: ClientResponse
  dateEncaissement: ISODate
  montantEncaisse: number
  /** Photo mémorisée à l'enregistrement (E10). */
  duChoisi: number
  /** < 0 : reste dû ; > 0 : surplus vers l'avance (E10, figé). */
  ecart: number
  detteAvant: number
  detteApres: number
  commentaire: string | null
  livraisons: LivraisonEncaisseeResponse[]
}

/** Livraison d'un client avec un reste dû (`GET …/a-encaisser`). */
export interface LivraisonAEncaisserResponse {
  id: UUID
  reference: string
  date: ISODate
  du: number
  paye: number
  resteDu: number
  remise: number
  statutEncaissement: StatutEncaissement
}

export interface LivraisonsAEncaisserResponse {
  /** Solde du client ; négatif = avance. */
  solde: number
  avance: number
  /** Les plus anciennes d'abord (date, référence, id). */
  livraisons: LivraisonAEncaisserResponse[]
}

/** Aperçu sans écriture (`POST …/apercu`). */
export interface ApercuEncaissementRequest {
  livreurId: UUID
  clientId: UUID
  livraisonIds: UUID[]
  montantEncaisse: number
  dateEncaissement?: string
  /** Aperçu d'une modification : l'encaissement est exclu du compte. */
  encaissementId?: UUID
}

export interface ApercuEncaissementResponse {
  duChoisi: number
  ecart: number
  soldeApres: number
  /** Chaque livraison choisie (part 0 si elle ne reçoit rien). */
  repartition: { livraisonId: UUID; reference: string; part: number; resteDuApres: number }[]
  /** Livraisons couvertes par le surplus (choisies ou non). */
  surplusImpute: { livraisonId: UUID; reference: string; part: number }[]
}

export interface EncoursClientResponse {
  clientId: UUID
  nomClient: string
  /** @deprecated Limite de crédit abandonnée. */
  limiteCredit?: number | null
  totalLivre: number
  totalRetour: number
  totalEncaisse: number
  solde: number
  /** @deprecated Limite de crédit abandonnée : plus affiché. */
  enDepassement?: boolean
  totalRemise: number
}

export interface MargeCumuleeResponse {
  margeBrute: number
  margeRetours: number
  margeReversee: number
  margeDue: number
  remiseEnAttente: number
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

export type StatutRelation = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'ANNULEE'

export interface RelationResume {
  id: UUID
  statut: StatutRelation
  dateInvitation: string        // ISO
  dateDecision: string | null   // ISO
}

/** `GET /livreur/me/fournisseurs` : annuaire avec l'état de la relation. */
export interface FournisseurAvecRelation extends FournisseurResponse {
  relation: RelationResume | null  // la plus récente, tous statuts ; null = jamais invité
  bloque: boolean
}

/** Réponse de l'invitation et de l'annulation. */
export interface RelationResponse {
  id: UUID
  statut: StatutRelation
  dateInvitation: string
  dateDecision: string | null
  fournisseur: { id: UUID; libelle: string }
  livreur: { id: UUID; nom: string; prenom: string }
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
export type StatutCommande =
  | 'ENVOYEE'
  | 'CONFIRMEE'
  | 'EN_RECEPTION'
  | 'REFUSEE'
  | 'ANNULEE'
  | 'LIVREE'

/** Personne citée par le back (`nom` = « prénom nom »). */
export interface PersonneRef {
  id: UUID
  nom: string
}

export interface ProduitCommandeResponse {
  id: UUID
  produit: ProduitResponse
  qteCommandee: number
  qteRecue: number             // Σ des réceptions actives
  qteRestante: number          // max(0, commandée − reçue) ; après « Passer à Livrée » : reliquat abandonné
  montantRecu: number          // Σ quantité × prix figé des réceptions actives
  remiseLivreurRecue: number   // Σ quantité × remise figée des réceptions actives
}

export interface LigneReceptionCommandeResponse {
  produit: ProduitResponse
  quantite: number
  prixUnitaire: number
  remiseLivreurUnitaire: number
}

export interface ReceptionCommandeResponse {
  id: UUID
  reference: string            // REC-n
  dateReception: string        // ISO
  receptionnePar: PersonneRef
  modifieePar: PersonneRef | null
  dateModification: string | null
  annulee: boolean
  annuleePar: PersonneRef | null
  dateAnnulation: string | null
  lignes: LigneReceptionCommandeResponse[]
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
  montantLivre: number | null  // Σ des réceptions actives ; null tant qu'aucune réception
  remiseLivreurLivree: number | null
  versementId: UUID | null     // non nul = réglée par un versement
  produitsCommandes: ProduitCommandeResponse[]
  apprentiAffecte: PersonneRef | null
  affectePar: PersonneRef | null
  dateAffectation: string | null
  receptions: ReceptionCommandeResponse[]
  livreeManuellement: boolean  // « Passer à Livrée »
  livreePar: PersonneRef | null
  dateLivree: string | null
}

export interface CreerCommandeRequest {
  fournisseurId: UUID
  produitsCommandes: Array<{ produitId: UUID; qteCommandee: number }>
  /** Apprenti affecté dès la création (facultatif). */
  apprentiId?: UUID | null
}

/**
 * Réception (POST) ou modification (PUT, contenu COMPLET de la réception) :
 * `dateReception` absente = maintenant (POST) ou inchangée (PUT).
 */
export interface ReceptionnerCommandeRequest {
  dateReception?: string
  lignes: Array<{ produitId: UUID; quantite: number }>
}

/** Ligne du catalogue d'un fournisseur (GET /produit-fournisseur?fournisseurId=). */
export interface ProduitFournisseurResponse {
  id: UUID
  produit: ProduitResponse
  fournisseur: FournisseurResponse
  prixDeVente: number
  /** Remise livreur par unité : remise partenaire (fournisseur, livreur racine), identique sur toutes les lignes. */
  remiseLivreur: number
  actif: boolean
  dateDesactivation?: string | null
  /** Vrai si le prix est un prix particulier accordé à ce livreur (concerne le prix uniquement). */
  prixParticulier: boolean
}

// ---------- Stock (compteur par livreur, journal des mouvements) ----------

/**
 * Une ligne du stock courant agrégée par produit (réceptions, transferts et
 * retours remis en stock, moins les livraisons enregistrées).
 * Source : `GET /stock-livreur/me/courant`.
 */
export interface StockCourantLigneResponse {
  produit: ProduitResponse
  qteVendable: number
  qteRetourneeSurPeriode: number
}

/**
 * Une ligne du stock d'un livreur (compteur `stock_courant_livreur`), ventilée
 * par produit. Source : `GET /stock-livreur/{livreurId}/actuel`. Les champs de
 * prix et de fournisseur sont conservés par le back mais ne sont plus renseignés
 * (plus d'achat manuel) : `fournisseur` et les prix sont `null`.
 */
export interface StockLivreurResponse {
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

/** Type d'un mouvement du journal de stock (`GET /stock-livreur/{id}/historique`). */
export type TypeMouvementStock =
  | 'RECEPTION'
  | 'TRANSFERT_ENTREE'
  | 'TRANSFERT_SORTIE'
  | 'LIVRAISON'
  | 'RETOUR_EN_STOCK'

/**
 * Un mouvement du stock d'un livreur (journal lu à la volée, trié du plus récent
 * au plus ancien). `quantite` est signée (+ entrée, − sortie).
 */
export interface MouvementStockResponse {
  date: string  // yyyy-MM-ddTHH:mm:ss
  type: TypeMouvementStock
  produit: ProduitResponse
  quantite: number
  reference: string | null
  contrepartie: string | null
}

/** Filtres facultatifs de l'historique du stock (période en jours entiers `yyyy-MM-dd`). */
export interface FiltresMouvementsStock {
  debut?: string
  fin?: string
  produitId?: UUID
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

// ── Retours (journal `retour_client`, GET/POST /retour) ──

export type OrigineRetour = 'MENU_RETOURS' | 'MODIFICATION_LIVRAISON' | 'CREATION_LIVRAISON'

export interface RetourResponse {
  id: UUID
  dateRetour: string
  /** Client actuel de la livraison. */
  client: { id: UUID; nom: string | null }
  livraison: { id: UUID; reference: string; date: string }
  produit: { id: UUID; designation: string }
  /** Signée : une valeur négative est une correction. */
  quantite: number
  /** `true` = remis en stock, `false` = perdu. */
  remisEnStock: boolean
  origine: OrigineRetour
  livreur: { id: UUID; nom: string | null }
  auteur: { id: UUID; nom: string | null }
  /** Indicative, signée ; nulle si la ligne a été retirée de la livraison. */
  valeur: number | null
}

export interface PageRetoursResponse {
  contenu: RetourResponse[]
  /** Page appliquée, à partir de 0. */
  page: number
  /** Taille appliquée (défaut 50, max 200). */
  taille: number
  total: number
}

export interface FiltresRetours {
  livreurId?: UUID
  /** yyyy-MM-dd, jour inclus. */
  debut?: string
  /** yyyy-MM-dd, jour inclus. */
  fin?: string
  clientId?: UUID
  produitId?: UUID
  page?: number
  taille?: number
}

export interface LigneRetourRequest {
  produitLivraisonId: UUID
  quantite: number
  remisEnStock: boolean
}

export interface EnregistrerRetourRequest {
  livraisonId: UUID
  /** Absente = maintenant (serveur). */
  dateRetour?: string
  lignes: LigneRetourRequest[]
}

export interface EnregistrerRetourResponse {
  retours: RetourResponse[]
  livraison: LivraisonResponse
}
