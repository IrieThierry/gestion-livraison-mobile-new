import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { ArrowRight, Info } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../components/shared/FormScreen';
import { SelectField } from '../../../../components/shared/SelectField';
import { useApprentis } from '../../../../features/apprentis/hooks';
import { useStockActuel, useStockCourant } from '../../../../features/stock/hooks';
import { useEffectuerTransfert, useTransfertsLivreur } from '../../../../features/transferts/hooks';
import { useMesRemises } from '../../../../features/remises-argent/hooks';
import {
  COMMENTAIRE_TRANSFERT_MAX,
  COMMENTAIRE_TRANSFERT_TROP_LONG,
  construireTransfert,
  messageAcceptationPar,
  messageQuantiteSuperieure,
  nomPrincipal,
  LIBELLE_PRINCIPAL_PAR_DEFAUT,
  type ModeTransfert,
} from '../../../../features/transferts/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { vocabulaire } from '../../../../features/organisation/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { useRetourListe } from '../../../../lib/useRetourListe';

const LIBELLE_ENVOI: Record<ModeTransfert, string> = {
  envoyer: 'Envoyer',
  reprendre: 'Reprendre',
  rendre: 'Rendre',
};

/**
 * Nouveau transfert de stock. Le transfert part « En attente » : il devra être
 * accepté par l'autre livreur.
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
  const [produitId, setProduitId] = useState<string | null>(null);
  const [qte, setQte] = useState('');
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
  const stockSource = useMemo(() => {
    if (mode === 'reprendre') {
      return (stockApprentiQ.data ?? []).map((s) => ({ produit: s.produit, qte: s.qte ?? 0 }));
    }
    return (monStockQ.data ?? []).map((s) => ({ produit: s.produit, qte: s.qteVendable ?? 0 }));
  }, [mode, stockApprentiQ.data, monStockQ.data]);

  const stockOptions = useMemo(
    () =>
      stockSource
        .filter((s) => s.qte > 0 && s.produit)
        .map((s) => ({ id: s.produit.id, label: `${s.produit.designation} · stock ${s.qte}` })),
    [stockSource],
  );

  const stockDispo = useMemo(
    () => (produitId ? stockSource.find((s) => s.produit?.id === produitId)?.qte ?? 0 : 0),
    [produitId, stockSource],
  );
  const qteNum = /^\d+$/.test(qte.trim()) ? parseInt(qte.trim(), 10) : 0;
  const insuffisant = !!produitId && qteNum > stockDispo;
  const commentaireTropLong = commentaire.trim().length > COMMENTAIRE_TRANSFERT_MAX;
  // Stock de la source illisible : état d'erreur, pas « aucun produit en stock ».
  const stockQ = mode === 'reprendre' ? (apprentiId ? stockApprentiQ : null) : monStockQ;
  const stockEnErreur = !!stockQ?.isError;

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

  const changerMode = (suivant: 'envoyer' | 'reprendre') => {
    if (suivant === modePrincipal) return;
    setModePrincipal(suivant);
    setProduitId(null);
    setQte('');
    setErreur(null);
  };

  const changerApprenti = (id: string | null) => {
    setApprentiId(id);
    // Reprise : le stock proposé est celui de l'apprenti.
    if (mode === 'reprendre') {
      setProduitId(null);
      setQte('');
    }
    setErreur(null);
  };

  const onSubmit = () => {
    const r = construireTransfert({
      mode,
      moiId: user.id,
      parentId: user.parentId,
      apprentiId,
      produitId,
      qte,
      commentaire,
      stockDispo,
    });
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      m.mutate(r.valeur, {
        onSuccess: () => {
          retourListe();
          dialog.success(
            mode === 'reprendre' ? 'Demande de reprise envoyée' : 'Transfert envoyé',
            accepteur ? messageAcceptationPar(accepteur) : undefined,
          );
        },
        onError: (e) => setErreur(extractApiErrorMessage(e, 'Transfert impossible.')),
        onSettled: fin,
      }),
    );
  };

  const libelleChamp = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2';

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
            <ArrowRight color="#10b981" size={20} />
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

          <SelectField
            label="Produit *"
            placeholder="Choisir un produit"
            value={produitId}
            onChange={(id) => {
              setProduitId(id);
              setErreur(null);
            }}
            options={stockOptions}
            isLoading={mode === 'reprendre' ? !!apprentiId && stockApprentiQ.isLoading : monStockQ.isLoading}
            emptyMessage={
              stockEnErreur
                ? 'Stock indisponible'
                : mode === 'reprendre'
                  ? apprentiId
                    ? 'Cet apprenti n’a aucun produit en stock.'
                    : 'Choisis d’abord un apprenti.'
                  : 'Aucun produit en stock. Réceptionne d’abord une commande.'
            }
          />
          {stockEnErreur ? (
            <Text accessibilityRole="alert" className="text-[11px] text-red-600 dark:text-red-400 font-bold -mt-1">
              {extractApiErrorMessage(stockQ?.error, 'Le stock n’a pas pu être lu.')}
            </Text>
          ) : null}

          <View>
            <Text className={libelleChamp}>Quantité * {produitId ? `(stock dispo : ${stockDispo})` : ''}</Text>
            <TextInput
              value={qte}
              onChangeText={(v) => {
                setQte(v);
                setErreur(null);
              }}
              keyboardType="number-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Quantité"
              className={`px-4 py-3.5 bg-white dark:bg-slate-900 border rounded-md text-slate-900 dark:text-white text-2xl font-extrabold ${
                insuffisant ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'border-slate-200 dark:border-slate-800'
              }`}
            />
            {insuffisant ? (
              <Text className="text-[11px] text-red-500 font-bold mt-1">{messageQuantiteSuperieure(stockDispo)}</Text>
            ) : null}
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
              insuffisant ? 'bg-slate-300 dark:bg-slate-700' : 'bg-emerald-500 active:opacity-80'
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
