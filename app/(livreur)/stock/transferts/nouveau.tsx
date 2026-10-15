import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { AlertCircle, ArrowRight, Info, Package, Plus, Trash2 } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { SelectField } from '../../../../components/shared/SelectField';
import { SearchInput } from '../../../../components/shared/SearchInput';
import { ProduitVignette } from '../../../../components/shared/ProduitVignette';
import { useApprentis } from '../../../../features/apprentis/hooks';
import { useStockActuel, useStockCourant } from '../../../../features/stock/hooks';
import { useEffectuerTransfert, useTransfertsLivreur } from '../../../../features/transferts/hooks';
import { useMesRemises } from '../../../../features/remises-argent/hooks';
import {
  ajouterLigneTransfert,
  COMMENTAIRE_TRANSFERT_MAX,
  COMMENTAIRE_TRANSFERT_TROP_LONG,
  construireTransfert,
  lignesAuDelaDuStock,
  messageAcceptationPar,
  messageQuantiteSuperieure,
  nomPrincipal,
  qteSaisie,
  LIBELLE_PRINCIPAL_PAR_DEFAUT,
  type LigneTransfertSaisie,
  type ModeTransfert,
} from '../../../../features/transferts/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { vocabulaire } from '../../../../features/organisation/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { AUCUN_RESULTAT, filtrerRecherche } from '../../../../lib/recherche';
import { trierParProduit } from '../../../../lib/tri';
import { useRetourListe } from '../../../../lib/useRetourListe';
import type { ProduitResponse } from '../../../../types/api';

const LIBELLE_ENVOI: Record<ModeTransfert, string> = {
  envoyer: 'Envoyer',
  reprendre: 'Reprendre',
  rendre: 'Rendre',
};

/**
 * Nouveau bon de transfert (P7), saisi comme une vente : on ajoute des
 * produits du stock de la source (la ligne ajoutée s'insère en tête), avec
 * une quantité par ligne limitée au stock. Le bon part « En attente » : il
 * devra être accepté par l'autre livreur.
 *  - Apprenti : « Rendre du stock » à son principal (destinataire fixe), sur
 *    son stock vendable.
 *  - Principal : « Envoyer » à un apprenti (sur son stock) ou « Reprendre du
 *    stock » à un apprenti (sur le stock de l'apprenti, qui sort à son
 *    acceptation).
 * Envoi protégé par `lancerUneFois`.
 */
export default function NouveauTransfert() {
  const user = useAuthStore((s) => s.user);
  const estApprenti = !!user?.parentId;
  // O4/O9 : commercial d'organisation, « Rendre au dépôt » de son responsable.
  const v = vocabulaire(user);
  const apprentisQ = useApprentis();
  const monStockQ = useStockCourant();
  // Apprenti : ses transferts donnent le nom de son principal (la session n'a que `parentId`).
  const mesTransfertsQ = useTransfertsLivreur(estApprenti ? user?.id : undefined);
  // À défaut de transfert, le principal est lu sur ses remises (comme le web).
  const mesRemisesQ = useMesRemises();
  const m = useEffectuerTransfert();
  const verrou = useRef(creerVerrou()).current;
  const retourListe = useRetourListe('/(livreur)/stock/transferts');

  const [modePrincipal, setModePrincipal] = useState<'envoyer' | 'reprendre'>('envoyer');
  const mode: ModeTransfert = estApprenti ? 'rendre' : modePrincipal;
  const [apprentiId, setApprentiId] = useState<string | null>(null);
  const [lignes, setLignes] = useState<LigneTransfertSaisie[]>([]);
  const [recherche, setRecherche] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  // Reprise : stock de l'apprenti choisi (compteur courant, produits à 0 omis).
  const stockApprentiQ = useStockActuel(mode === 'reprendre' && apprentiId ? apprentiId : '');

  const apprentisOptions = useMemo(
    () =>
      (apprentisQ.data ?? [])
        .filter((a) => a.actif !== false)
        .map((a) => ({ id: a.id, label: `${a.prenom} ${a.nom}` })),
    [apprentisQ.data],
  );

  // Stock de la source : le mien (envoyer, rendre) ou celui de l'apprenti (reprendre).
  const stockSource = useMemo((): { produit: ProduitResponse; qte: number }[] => {
    if (mode === 'reprendre') {
      return (stockApprentiQ.data ?? []).map((s) => ({ produit: s.produit, qte: s.qte ?? 0 }));
    }
    return (monStockQ.data ?? []).map((s) => ({ produit: s.produit, qte: s.qteVendable ?? 0 }));
  }, [mode, stockApprentiQ.data, monStockQ.data]);

  // Produits proposés : en stock chez la source, triés par désignation (P3).
  const enStock = useMemo(() => trierParProduit(stockSource.filter((s) => s.qte > 0 && s.produit)), [stockSource]);
  const proposes = useMemo(
    () => filtrerRecherche(enStock, recherche, (s) => [s.produit.designation, s.produit.code]),
    [enStock, recherche],
  );
  const stock = useMemo(() => {
    const parProduit = new Map<string, number>();
    for (const s of stockSource) if (s.produit?.id) parProduit.set(s.produit.id, s.qte);
    return parProduit;
  }, [stockSource]);
  const photos = useMemo(
    () => new Map(stockSource.map((s) => [s.produit?.id, s.produit?.photoUrl ?? null] as const)),
    [stockSource],
  );

  const auDelaDuStock = lignesAuDelaDuStock(lignes, stock);
  const insuffisant = auDelaDuStock.length > 0;
  const commentaireTropLong = commentaire.trim().length > COMMENTAIRE_TRANSFERT_MAX;
  // Stock de la source illisible : état d'erreur, pas « aucun produit en stock ».
  const stockQ = mode === 'reprendre' ? (apprentiId ? stockApprentiQ : null) : monStockQ;
  const stockEnErreur = !!stockQ?.isError;
  const stockEnLecture = mode === 'reprendre' ? !!apprentiId && stockApprentiQ.isLoading : monStockQ.isLoading;

  if (!user) return null;

  const nomApprenti = apprentiId ? apprentisOptions.find((o) => o.id === apprentiId)?.label ?? null : null;
  const nomLu = nomPrincipal(mesTransfertsQ.data, user.parentId, mesRemisesQ.data);
  // Nom inconnu : « ton responsable » pour un commercial d'organisation.
  const nomPrincipalApprenti = nomLu === LIBELLE_PRINCIPAL_PAR_DEFAUT ? v.tonPrincipal : nomLu;
  const moi = `${user.prenom} ${user.nom} (toi)`;
  // Qui devra accepter : le principal (rendre) ou l'apprenti choisi (envoyer, reprendre).
  const accepteur = estApprenti ? nomPrincipalApprenti : nomApprenti;
  const source = mode === 'reprendre' ? nomApprenti ?? '—' : moi;
  const destinataire = mode === 'rendre' ? nomPrincipalApprenti : mode === 'reprendre' ? moi : nomApprenti ?? '—';

  const viderLignes = () => {
    setLignes([]);
    setRecherche('');
  };

  const changerMode = (suivant: 'envoyer' | 'reprendre') => {
    if (suivant === modePrincipal) return;
    setModePrincipal(suivant);
    // Autre source : les lignes saisies ne valent plus.
    viderLignes();
    setErreur(null);
  };

  const changerApprenti = (id: string | null) => {
    setApprentiId(id);
    // Reprise : le stock proposé est celui de l'apprenti.
    if (mode === 'reprendre') viderLignes();
    setErreur(null);
  };

  const ajouter = (produit: ProduitResponse) => {
    setLignes((ls) => ajouterLigneTransfert(ls, produit));
    setErreur(null);
  };
  const changerQte = (produitId: string, brut: string) => {
    const qte = qteSaisie(brut);
    setLignes((ls) => ls.map((l) => (l.produitId === produitId ? { ...l, qte } : l)));
    setErreur(null);
  };
  const retirer = (produitId: string) => {
    setLignes((ls) => ls.filter((l) => l.produitId !== produitId));
    setErreur(null);
  };

  const onSubmit = () => {
    const r = construireTransfert({
      mode,
      moiId: user.id,
      parentId: user.parentId,
      apprentiId,
      lignes,
      commentaire,
      stock,
    });
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      m.mutate(r.valeur, {
        onSuccess: (bon) => {
          retourListe();
          const ref = bon?.reference ? ` ${bon.reference}` : '';
          dialog.success(
            mode === 'reprendre' ? `Demande de reprise${ref} envoyée` : `Transfert${ref} envoyé`,
            accepteur ? messageAcceptationPar(accepteur) : undefined,
          );
        },
        onError: (e) => setErreur(extractApiErrorMessage(e, 'Transfert impossible.')),
        onSettled: fin,
      }),
    );
  };

  const libelleChamp = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2';
  const messageSansProduit = stockEnErreur
    ? 'Stock indisponible'
    : mode === 'reprendre'
      ? apprentiId
        ? 'Cet apprenti n’a aucun produit en stock.'
        : 'Choisis d’abord un apprenti.'
      : 'Aucun produit en stock. Réceptionne d’abord une commande.';

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={estApprenti ? v.rendreStock : 'Nouveau transfert'}
        subtitle={estApprenti ? `À ${v.tonPrincipal}` : `Avec un ${v.apprenti}`}
      />

      <FormScreen>
        <View className="px-4 pt-3 gap-3">
          {!estApprenti ? (
            <View className="flex-row bg-slate-100 dark:bg-slate-800 rounded-md p-1">
              {(
                [
                  { id: 'envoyer', label: 'Envoyer à un apprenti' },
                  { id: 'reprendre', label: 'Reprendre du stock' },
                ] as const
              ).map((o) => {
                const actif = modePrincipal === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => changerMode(o.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actif }}
                    className={`flex-1 py-2 rounded items-center ${actif ? 'bg-white dark:bg-slate-900' : ''}`}
                  >
                    <Text
                      className={`text-[13px] font-bold ${
                        actif ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Source → destinataire */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-2">
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Source
              </Text>
              <Text className="font-extrabold text-slate-900 dark:text-white">{source}</Text>
            </View>
            <ArrowRight color="#047857" size={20} />
            <View className="flex-1 items-end">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Destinataire
              </Text>
              <Text className="font-extrabold text-slate-900 dark:text-white text-right">{destinataire}</Text>
            </View>
          </View>

          {!estApprenti ? (
            <SelectField
              label={mode === 'reprendre' ? 'Apprenti *' : 'Apprenti destinataire *'}
              placeholder="Choisir un apprenti"
              value={apprentiId}
              onChange={changerApprenti}
              options={apprentisOptions}
              isLoading={apprentisQ.isLoading}
              emptyMessage="Aucun apprenti actif. Crée un apprenti depuis Profil → Mes apprentis."
            />
          ) : null}

          {accepteur ? (
            <View className="flex-row items-start gap-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-md p-3">
              <Info color="#2563eb" size={16} />
              <Text className="flex-1 text-[12px] text-blue-800 dark:text-blue-200">
                {messageAcceptationPar(accepteur)}
              </Text>
            </View>
          ) : null}

          {/* Produits en stock chez la source : un appui ajoute la ligne en tête. */}
          <View>
            <Text className={libelleChamp}>Produits *</Text>
            {enStock.length > 0 ? (
              <SearchInput
                value={recherche}
                onChangeText={setRecherche}
                placeholder="Rechercher un produit…"
                className="mb-2"
              />
            ) : null}
            {stockEnLecture ? (
              <ActivityIndicator color="#047857" />
            ) : enStock.length === 0 ? (
              <Text className="text-[12px] text-slate-500 dark:text-slate-400">{messageSansProduit}</Text>
            ) : null}
            {stockEnErreur ? (
              <Text accessibilityRole="alert" className="text-[11px] text-red-600 dark:text-red-400 font-bold mt-1">
                {extractApiErrorMessage(stockQ?.error, 'Le stock n’a pas pu être lu.')}
              </Text>
            ) : null}
            {proposes.length === 0 && recherche.trim() ? (
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-2">{AUCUN_RESULTAT}</Text>
            ) : null}
            <View className="flex-row flex-wrap gap-2">
              {proposes.map((s) => {
                const deja = lignes.some((l) => l.produitId === s.produit.id);
                return (
                  <Pressable
                    key={s.produit.id}
                    onPress={() => ajouter(s.produit)}
                    disabled={deja}
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter ${s.produit.designation}`}
                    className={`bg-white dark:bg-slate-900 border px-3 py-2 rounded-md flex-row items-center gap-1.5 active:opacity-70 ${
                      deja ? 'border-emerald-300 dark:border-emerald-800 opacity-50' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <ProduitVignette designation={s.produit.designation} photoUrl={s.produit.photoUrl} size={22} />
                    <Plus color={deja ? '#94a3b8' : '#047857'} size={14} />
                    <Text className={`text-sm ${deja ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                      {s.produit.designation}
                    </Text>
                    <Text className="text-[10px] font-mono text-slate-400 dark:text-slate-500">· {s.qte}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text className={libelleChamp}>Lignes ({lignes.length})</Text>
            <View className="gap-2">
              {lignes.map((l) => {
                const dispo = stock.get(l.produitId) ?? 0;
                const auDela = l.qte > dispo;
                return (
                  <View
                    key={l.produitId}
                    accessibilityLabel={`Ligne ${l.designation}`}
                    className={`bg-white dark:bg-slate-900 border rounded-md p-3 ${
                      auDela ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <View className="flex-row items-center gap-2">
                      <ProduitVignette designation={l.designation} photoUrl={photos.get(l.produitId) ?? null} size={32} />
                      <Text className="font-extrabold text-slate-900 dark:text-white flex-1">{l.designation}</Text>
                      <TextInput
                        value={l.qte > 0 ? String(l.qte) : ''}
                        onChangeText={(t) => changerQte(l.produitId, t)}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                        accessibilityLabel={`Quantité ${l.designation}`}
                        className={`w-20 px-2 py-2 rounded-md text-center text-base text-slate-900 dark:text-white border ${
                          auDela || l.qte === 0
                            ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                        }`}
                      />
                      <Pressable
                        onPress={() => retirer(l.produitId)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer ${l.designation}`}
                        className="active:opacity-60 p-1"
                      >
                        <Trash2 color="#ef4444" size={18} />
                      </Pressable>
                    </View>
                    <View className="flex-row items-center gap-1.5 mt-2">
                      <Package color={auDela ? '#ef4444' : '#64748b'} size={12} />
                      <Text className={`text-[11px] ${auDela ? 'text-red-500 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                        Stock dispo : {dispo}
                      </Text>
                    </View>
                    {auDela ? (
                      <View className="flex-row items-center gap-1.5 mt-1">
                        <AlertCircle color="#ef4444" size={12} />
                        <Text className="text-[11px] text-red-500 font-bold">{messageQuantiteSuperieure(dispo)}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View>
            <Text className={libelleChamp}>Commentaire (facultatif)</Text>
            <TextInput
              value={commentaire}
              onChangeText={setCommentaire}
              multiline
              maxLength={COMMENTAIRE_TRANSFERT_MAX}
              placeholder="…"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Commentaire"
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white min-h-[80px]"
              style={{ textAlignVertical: 'top' }}
            />
            {commentaireTropLong ? (
              <Text className="text-[11px] text-red-500 font-bold mt-1">{COMMENTAIRE_TRANSFERT_TROP_LONG}</Text>
            ) : null}
          </View>

          {erreur ? <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold">{erreur}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || insuffisant}
            accessibilityRole="button"
            className={`rounded-md py-3.5 mt-3 items-center ${
              insuffisant ? 'bg-slate-300 dark:bg-slate-700' : 'bg-emerald-700 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${insuffisant ? 'text-slate-500' : 'text-white'}`}>
                {LIBELLE_ENVOI[mode]}
              </Text>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
