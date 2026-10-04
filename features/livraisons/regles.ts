import type {
  ClientResponse,
  CreerLivraisonRequest,
  LivraisonResponse,
  UUID,
} from '../../types/api';

/** Ligne saisie dans le formulaire de livraison (ProduitPicker). */
export interface LigneSaisie {
  produitId: UUID;
  designation: string;
  prix: number;
  qte: number;
  /**
   * Remise unitaire affichée et estimée (client avec remise) : pré-remplie
   * depuis la remise convenue, ou saisie. `undefined` tant que les remises
   * convenues ne sont pas chargées et que rien n'est saisi.
   */
  remise?: number;
  /**
   * Vrai seulement si le livreur a saisi la remise (« 0 » compris). Seule une
   * remise saisie est envoyée en `remiseUnitaire` ; sinon le back applique la
   * remise convenue pour (client, produit).
   */
  remiseSaisie?: boolean;
  /** Saisie de remise invalide (bloque l'enregistrement). */
  remiseInvalide?: boolean;
  /** Le livreur a choisi de mémoriser le prix saisi pour ce client. */
  memoriserPrix?: boolean;
}

/**
 * Estimation du montant d'une ligne, même formule que le back :
 * (prix + remise unitaire) × quantité.
 */
export function montantLigneEstime(prix: number, remise: number | undefined, qte: number): number {
  return ((Number(prix) || 0) + (Number(remise) || 0)) * (Number(qte) || 0);
}

/** Estimation du total de la livraison en cours de saisie. */
export function totalLivraisonEstime(lignes: LigneSaisie[], avecRemise: boolean): number {
  return lignes
    .filter((l) => l.qte > 0)
    .reduce((acc, l) => acc + montantLigneEstime(l.prix, avecRemise ? l.remise : 0, l.qte), 0);
}

/** Message d'erreur bloquant pour les lignes à livrer, ou null si valides. */
export function erreurLignesLivraison(lignes: LigneSaisie[], avecRemise: boolean): string | null {
  const valides = lignes.filter((l) => l.qte > 0);
  if (valides.some((l) => !(l.prix > 0))) {
    return 'Définis un prix unitaire (> 0) pour chaque ligne.';
  }
  if (avecRemise && valides.some((l) => l.remiseInvalide || (l.remise !== undefined && !(l.remise >= 0)))) {
    return 'Une remise est invalide (nombre positif, 2 décimales maximum).';
  }
  return null;
}

/**
 * Payload `POST /livraison`. Seules les lignes avec une quantité > 0 sont
 * envoyées. `memoriserPrixClient` est toujours explicite (le back mémorise le
 * prix dans la même transaction). `remiseUnitaire` n'est envoyée que pour un
 * client avec remise et une remise SAISIE par le livreur (le back la mémorise,
 * D9) ; une remise seulement pré-remplie n'est pas envoyée : le back applique
 * la remise convenue (et 0 pour un client sans remise).
 */
export function buildCreerLivraisonPayload(input: {
  livreurId: UUID;
  client: Pick<ClientResponse, 'id' | 'avecOuSansRemise'>;
  lignes: LigneSaisie[];
}): CreerLivraisonRequest {
  const avecRemise = input.client.avecOuSansRemise === true;
  return {
    livreurId: input.livreurId,
    clientId: input.client.id,
    avecRemise,
    produitsLivraison: input.lignes
      .filter((l) => l.qte > 0)
      .map((l) => ({
        produitId: l.produitId,
        qteLivree: l.qte,
        qteRetournee: 0,
        qteRetourneeEnStock: 0,
        prixDeVente: l.prix,
        memoriserPrixClient: l.memoriserPrix === true,
        ...(avecRemise && l.remiseSaisie === true && l.remise !== undefined
          ? { remiseUnitaire: l.remise }
          : {}),
      })),
  };
}

/** Retours à enregistrer sur une livraison antérieure. */
export interface RetoursParLivraison {
  livraison: LivraisonResponse;
  lignes: Array<{ produitLivraisonId: UUID; quantite: number; remettreEnStock: boolean }>;
}

/**
 * Saisie d'un retour en attente, indexée par id de ligne de livraison.
 * `enStock` : true = remettre en stock, false = perdu, null = pas encore
 * choisi (D3 : aucun choix par défaut).
 */
export type SaisieRetours = Record<UUID, { qte: number; enStock: boolean | null }>;

export const MESSAGE_DESTINATION_RETOUR =
  'Choisis « Remettre en stock » ou « Perdu » pour chaque retour.';

/** Nombre de retours saisis (> 0) dont la destination n'est pas choisie. */
export function retoursSansDestination(saisie: SaisieRetours): number {
  return Object.values(saisie).filter((s) => s.qte > 0 && s.enStock === null).length;
}

/**
 * Regroupe les retours saisis (> 0) par livraison source (un PUT par
 * livraison). Refuse toute saisie sans destination choisie.
 */
export function regrouperRetours(
  livraisons: LivraisonResponse[],
  saisie: SaisieRetours,
): { ok: true; valeur: RetoursParLivraison[] } | { ok: false; erreur: string } {
  const res: RetoursParLivraison[] = [];
  for (const livraison of livraisons) {
    const lignes: RetoursParLivraison['lignes'] = [];
    for (const p of livraison.produitsLivraison ?? []) {
      const s = saisie[p.id];
      if (!s || !(s.qte > 0)) continue;
      if (s.enStock === null) return { ok: false, erreur: MESSAGE_DESTINATION_RETOUR };
      lignes.push({ produitLivraisonId: p.id, quantite: s.qte, remettreEnStock: s.enStock });
    }
    if (lignes.length > 0) res.push({ livraison, lignes });
  }
  return { ok: true, valeur: res };
}

/**
 * État du formulaire après un échec partiel (création réussie ou absente,
 * au moins un retour en échec) : les lignes de la livraison créée sont
 * vidées (un nouvel appui ne la recrée pas) et seuls les retours échoués
 * restent à refaire.
 */
export function etatApresEchecPartiel<L>(input: {
  res: ResultatLivraisonEtRetours;
  retours: RetoursParLivraison[];
  lignes: L[];
  saisie: SaisieRetours;
}): { lignes: L[]; saisie: SaisieRetours } {
  const { res, retours } = input;
  const faits = new Set<UUID>();
  for (const r of retours) {
    if (res.retoursEnregistres.includes(r.livraison.id)) {
      for (const l of r.lignes) faits.add(l.produitLivraisonId);
    }
  }
  const saisie: SaisieRetours = {};
  for (const [id, v] of Object.entries(input.saisie)) if (!faits.has(id)) saisie[id] = v;
  return { lignes: res.livraisonCreee ? [] : input.lignes, saisie };
}

/**
 * Bilan lisible d'un enregistrement livraison + retours : ce qui est fait et
 * ce qui reste à refaire. `ok` est faux dès qu'une écriture a échoué.
 */
export function bilanLivraisonEtRetours(
  res: ResultatLivraisonEtRetours,
  demande: { livraison: boolean; nbRetours: number },
): { ok: boolean; titre: string; message: string } {
  if (res.erreurLivraison !== null) {
    return {
      ok: false,
      titre: 'Livraison non enregistrée',
      message:
        res.erreurLivraison +
        (demande.nbRetours > 0 ? '\nAucun retour n’a été enregistré.' : ''),
    };
  }
  const nbOk = res.retoursEnregistres.length;
  const nbKo = res.retoursEchoues.length;
  if (nbKo === 0) {
    const titre =
      demande.livraison && nbOk > 0
        ? 'Livraison et retour(s) enregistrés'
        : demande.livraison
        ? 'Livraison enregistrée'
        : 'Retour(s) enregistré(s)';
    return { ok: true, titre, message: '' };
  }
  const fait: string[] = [];
  if (res.livraisonCreee) fait.push('Livraison du jour créée.');
  if (nbOk > 0) fait.push(`${nbOk} retour(s) enregistré(s).`);
  const details = res.retoursEchoues.map((e) => `• ${e.message}`).join('\n');
  return {
    ok: false,
    titre: 'Enregistrement incomplet',
    message:
      (fait.length > 0 ? `${fait.join(' ')}\n` : '') +
      `${nbKo} retour(s) non enregistré(s), à refaire :\n${details}`,
  };
}

export interface ResultatLivraisonEtRetours {
  /** Vrai si la livraison du jour a été créée (faux s'il n'y en avait pas à créer). */
  livraisonCreee: boolean;
  /** Message d'échec de la création (rien n'a été enregistré). */
  erreurLivraison: string | null;
  retoursEnregistres: UUID[];
  retoursEchoues: Array<{ livraisonId: UUID; message: string }>;
}

/**
 * Enchaîne la création de la livraison puis les retours, livraison par
 * livraison, SANS s'arrêter au premier échec de retour : chaque issue est
 * rapportée pour que l'écran dise ce qui est fait et ce qui reste à refaire.
 * Si la création échoue, aucun retour n'est tenté.
 */
export async function enregistrerLivraisonEtRetours(input: {
  creer: (() => Promise<unknown>) | null;
  retours: RetoursParLivraison[];
  enregistrerRetour: (r: RetoursParLivraison) => Promise<unknown>;
  messageErreur: (err: unknown) => string;
}): Promise<ResultatLivraisonEtRetours> {
  const res: ResultatLivraisonEtRetours = {
    livraisonCreee: false,
    erreurLivraison: null,
    retoursEnregistres: [],
    retoursEchoues: [],
  };
  if (input.creer) {
    try {
      await input.creer();
      res.livraisonCreee = true;
    } catch (err) {
      res.erreurLivraison = input.messageErreur(err);
      return res;
    }
  }
  for (const r of input.retours) {
    try {
      await input.enregistrerRetour(r);
      res.retoursEnregistres.push(r.livraison.id);
    } catch (err) {
      res.retoursEchoues.push({ livraisonId: r.livraison.id, message: input.messageErreur(err) });
    }
  }
  return res;
}
