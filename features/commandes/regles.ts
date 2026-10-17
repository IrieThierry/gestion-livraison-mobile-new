import type {
  CommandeResponse,
  CreerCommandeRequest,
  ProduitCommandeResponse,
  ProduitFournisseurResponse,
  ReceptionCommandeResponse,
  ReceptionnerCommandeRequest,
  StatutCommande,
  UUID,
} from '../../types/api';

/** Quantités saisies, indexées par id de produit (valeurs brutes des champs). */
export type Quantites = Record<UUID, string>;

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreur: string };

export type FiltreStatutCommande = StatutCommande | 'TOUTES';

export const FILTRES_STATUT_COMMANDE: Array<{ valeur: FiltreStatutCommande; label: string }> = [
  { valeur: 'TOUTES', label: 'Toutes' },
  { valeur: 'ENVOYEE', label: 'Envoyées' },
  { valeur: 'CONFIRMEE', label: 'Confirmées' },
  { valeur: 'EN_RECEPTION', label: 'En réception' },
  { valeur: 'LIVREE', label: 'Livrées' },
  { valeur: 'REFUSEE', label: 'Refusées' },
  { valeur: 'ANNULEE', label: 'Annulées' },
];

// ─── Droits par statut ────────────────────────────────────────────────────

/** Le livreur n'annule que tant que le fournisseur n'a pas répondu. */
export const peutAnnuler = (c: CommandeResponse) => c.statut === 'ENVOYEE';

/** Livrée et pas encore rattachée à un versement. */
export const estReglable = (c: CommandeResponse) => c.statut === 'LIVREE' && c.versementId === null;

/** Le livreur connecté est le livreur principal titulaire de la commande. */
export const estTitulaireCommande = (
  c: CommandeResponse,
  user: { id: UUID; parentId?: UUID | null } | null | undefined,
) => !!user && !user.parentId && c.livreur.id === user.id;

/**
 * Fournisseur avec au moins un commis actif : les remises passent par son commis,
 * le livreur les confirme ; il ne réceptionne plus, ne passe plus à Livrée et ne
 * corrige plus de réception (le back refuse aussi).
 */
export const estGereeParCommis = (c: CommandeResponse) => c.gereeParCommis === true;

/** Réception possible (titulaire ou apprenti affecté) : commande confirmée ou en réception, sans commis. */
export const peutReceptionner = (c: CommandeResponse) =>
  !estGereeParCommis(c) && (c.statut === 'CONFIRMEE' || c.statut === 'EN_RECEPTION');

/** « Passer à Livrée » : seulement une commande en réception, sans commis. */
export const peutPasserLivree = (c: CommandeResponse) =>
  !estGereeParCommis(c) && c.statut === 'EN_RECEPTION';

/** Modifier / annuler une réception : titulaire, réception active, commande non réglée, sans commis. */
export const peutCorrigerReception = (
  c: CommandeResponse,
  r: ReceptionCommandeResponse,
  estTitulaire: boolean,
) => estTitulaire && !r.annulee && c.versementId === null && !estGereeParCommis(c);

const STATUTS_APPRENTI_MODIFIABLE: StatutCommande[] = ['ENVOYEE', 'CONFIRMEE', 'EN_RECEPTION'];

/** Changer (ou retirer) l'apprenti affecté : titulaire, commande ni livrée, ni refusée, ni annulée. */
export const peutChangerApprenti = (c: CommandeResponse, estTitulaire: boolean) =>
  estTitulaire && STATUTS_APPRENTI_MODIFIABLE.includes(c.statut);

/** Lignes non entièrement reçues (abandonnées par « Passer à Livrée »). */
export const reliquat = (c: CommandeResponse): ProduitCommandeResponse[] =>
  c.produitsCommandes.filter((l) => l.qteRestante > 0);

/**
 * Lignes du catalogue sur lesquelles on peut commander : actives (`actif !== false`,
 * défense : le back filtre déjà), triées par désignation.
 */
export function lignesCommandables(
  catalogue: ProduitFournisseurResponse[],
): ProduitFournisseurResponse[] {
  return catalogue
    .filter((l) => l.actif !== false)
    .sort((a, b) => a.produit.designation.localeCompare(b.produit.designation, 'fr'));
}

// ─── Validation des saisies ───────────────────────────────────────────────

/** null = champ vide ; NaN = pas un entier ; sinon l'entier saisi. */
function parseEntier(valeur: string | undefined): number | null {
  if (valeur === undefined || valeur.trim() === '') return null;
  const n = Number(valeur);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function construireCommande(
  fournisseurId: string,
  quantites: Quantites,
): Resultat<CreerCommandeRequest> {
  if (!fournisseurId) return { ok: false, erreur: 'Choisis un fournisseur.' };
  const lignes: CreerCommandeRequest['produitsCommandes'] = [];
  for (const [produitId, saisie] of Object.entries(quantites)) {
    const n = parseEntier(saisie);
    if (n === null) continue;
    if (Number.isNaN(n) || n < 1) {
      return { ok: false, erreur: 'Les quantités doivent être des entiers supérieurs ou égaux à 1.' };
    }
    lignes.push({ produitId, qteCommandee: n });
  }
  if (lignes.length === 0) return { ok: false, erreur: 'Saisis au moins une quantité.' };
  return { ok: true, valeur: { fournisseurId, produitsCommandes: lignes } };
}

/**
 * Remise livreur par unité du fournisseur (remise partenaire, identique sur toutes les lignes) :
 * 0 si le catalogue est vide ou si aucune remise n'est accordée.
 */
export function remisePartenaire(catalogue: ProduitFournisseurResponse[]): number {
  return catalogue[0]?.remiseLivreur ?? 0;
}

// ─── Réceptions ───────────────────────────────────────────────────────────

/**
 * Lignes de réception à envoyer : chaque ligne de commande est bornée par `borne(l)`.
 * Champ vide = 0 ; seules les quantités > 0 sont envoyées.
 */
function construireLignesRecues(
  lignes: ProduitCommandeResponse[],
  quantites: Quantites,
  borne: (l: ProduitCommandeResponse) => number,
  messageVide = 'Saisissez au moins une quantité reçue.',
): Resultat<ReceptionnerCommandeRequest['lignes']> {
  const res: ReceptionnerCommandeRequest['lignes'] = [];
  for (const l of lignes) {
    const nom = l.produit.designation;
    const n = parseEntier(quantites[l.produit.id]) ?? 0;
    if (Number.isNaN(n) || n < 0) {
      return {
        ok: false,
        erreur: `La quantité reçue de ${nom} doit être un entier supérieur ou égal à 0.`,
      };
    }
    const max = borne(l);
    if (n > max) return { ok: false, erreur: `Au plus ${max} pour ${nom}.` };
    if (n > 0) res.push({ produitId: l.produit.id, quantite: n });
  }
  if (res.length === 0) return { ok: false, erreur: messageVide };
  return { ok: true, valeur: res };
}

/**
 * Nouvelle réception : quantité par produit bornée par la quantité restante.
 * `dateReception` absente = maintenant (côté serveur).
 */
export function construireReception(
  lignes: ProduitCommandeResponse[],
  quantites: Quantites,
  dateReception?: string,
): Resultat<ReceptionnerCommandeRequest> {
  const r = construireLignesRecues(lignes, quantites, (l) => l.qteRestante);
  if (!r.ok) return r;
  return {
    ok: true,
    valeur: dateReception ? { dateReception, lignes: r.valeur } : { lignes: r.valeur },
  };
}

/** Quantité de ce produit dans la réception. */
export function quantiteDansReception(r: ReceptionCommandeResponse, produitId: UUID): number {
  return r.lignes
    .filter((l) => l.produit.id === produitId)
    .reduce((s, l) => s + l.quantite, 0);
}

/** Saisie pré-remplie avec les quantités actuelles de la réception. */
export function quantitesDeReception(r: ReceptionCommandeResponse): Quantites {
  const q: Quantites = {};
  for (const l of r.lignes) q[l.produit.id] = String(quantiteDansReception(r, l.produit.id));
  return q;
}

/**
 * Modification d'une réception : le corps est le contenu COMPLET de la réception
 * (un produit absent ou à 0 est retiré, un produit de la commande peut être ajouté).
 * Borne d'un produit = quantité restante + quantité actuelle de cette réception.
 * `dateReception` absente = date inchangée.
 */
export function construireModificationReception(
  c: CommandeResponse,
  r: ReceptionCommandeResponse,
  quantites: Quantites,
  dateReception?: string,
): Resultat<ReceptionnerCommandeRequest> {
  const res = construireLignesRecues(
    c.produitsCommandes,
    quantites,
    (l) => l.qteRestante + quantiteDansReception(r, l.produit.id),
    'Saisissez au moins une quantité reçue ; pour tout retirer, annulez la réception.',
  );
  if (!res.ok) return res;
  return {
    ok: true,
    valeur: dateReception ? { dateReception, lignes: res.valeur } : { lignes: res.valeur },
  };
}

/**
 * Date de réception envoyée : aucune ou `inchangee` (aujourd'hui pour une réception,
 * jour d'origine pour une modification) → rien ; un autre jour → ce jour à 00:00
 * (le serveur compare au jour civil).
 */
export function dateReceptionParam(
  choisie: string | null,
  inchangee: string,
): string | undefined {
  if (!choisie || choisie === inchangee) return undefined;
  return `${choisie}T00:00:00`;
}

// ─── Montants (N2) ────────────────────────────────────────────────────────

/** Quantité valide saisie pour une ligne (entier ≥ 1), sinon 0. */
export function quantiteSaisie(quantites: Quantites, produitId: UUID): number {
  const n = parseEntier(quantites[produitId]);
  return n === null || Number.isNaN(n) || n < 1 ? 0 : n;
}

/**
 * R1 : montant d'une ligne de commande, comme une ligne de livraison :
 * quantité × (prix + remise livreur).
 */
export function montantLigneCommande(prix: number, remise: number | undefined, qte: number): number {
  return ((Number(prix) || 0) + (Number(remise) || 0)) * (Number(qte) || 0);
}

type LigneEstimable = Pick<ProduitFournisseurResponse, 'prixDeVente' | 'produit'> &
  Partial<Pick<ProduitFournisseurResponse, 'remiseLivreur'>>;

/**
 * R1 : totaux estimés à la saisie. `prix` = Σ quantité × prix affiché
 * (`prixDeVente` = prix particulier s'il existe, sinon prix fournisseur),
 * `remise` = Σ quantité × remise livreur, `total` = prix + remise.
 * Les saisies vides ou invalides comptent pour 0.
 */
export function totauxEstimes(
  lignes: LigneEstimable[],
  quantites: Quantites,
): { prix: number; remise: number; total: number } {
  let prix = 0;
  let remise = 0;
  for (const l of lignes) {
    const n = quantiteSaisie(quantites, l.produit.id);
    if (n === 0) continue;
    prix += n * (Number(l.prixDeVente) || 0);
    remise += n * (Number(l.remiseLivreur) || 0);
  }
  return { prix, remise, total: prix + remise };
}

/** Total estimé à la saisie : Σ quantité × (prix affiché + remise livreur). */
export function totalEstime(lignes: LigneEstimable[], quantites: Quantites): number {
  return totauxEstimes(lignes, quantites).total;
}

/**
 * Montant à afficher sur une commande : « Montant estimé » tant que
 * `montantLivre` est nul ou à 0, puis « Montant livré ». `montant` est nul
 * si le back n'a pu estimer aucune ligne.
 */
export function montantCommande(
  c: Pick<CommandeResponse, 'montantLivre' | 'montantEstime'>,
): { libelle: 'Montant estimé' | 'Montant livré'; montant: number | null } {
  if (c.montantLivre != null && c.montantLivre !== 0) {
    return { libelle: 'Montant livré', montant: c.montantLivre };
  }
  return { libelle: 'Montant estimé', montant: c.montantEstime ?? null };
}
