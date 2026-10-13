import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Save, Trash2, Tag } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { FormScreen } from '../../../components/shared/FormScreen';
import { SearchInput } from '../../../components/shared/SearchInput';
import { AUCUN_RESULTAT, filtrerRecherche } from '../../../lib/recherche';
import { useProduits } from '../../../features/produits/hooks';
import {
  useMesPrix,
  useUpsertPrixLivreur,
  useSupprimerPrixLivreur,
} from '../../../features/prix/hooks';
import { formatFCFA } from '../../../lib/format';
import { dialog } from '../../../lib/dialog';
import type { ProduitResponse } from '../../../types/api';
import { ProduitVignette } from '../../../components/shared/ProduitVignette';
import { useAuthStore } from '../../../stores/authStore';
import { estCommercial } from '../../../features/organisation/regles';
import { useGrillePrix } from '../../../features/organisation/hooks';

/**
 * « Mes prix de vente » — barème par défaut du livreur.
 *
 * Ces prix s'appliquent à toutes les livraisons (et celles des apprentis)
 * sauf si un prix custom existe pour le couple (client × produit). Le
 * résolveur backend `/prix/resoudre` applique cette cascade.
 *
 * L'écran est volontairement le miroir de la page web `MesPrixPage`. Les
 * deux portails partagent les mêmes endpoints, donc une modification ici
 * est visible sur le web et inversement.
 */
export default function MesPrixPage() {
  // O6 : le commercial d'organisation consulte la grille fixée par son responsable (lecture seule),
  // lue sur `GET /organisation/me/grille-prix` (catalogue de l'organisation et prix du responsable).
  const lectureSeule = estCommercial(useAuthStore((s) => s.user));
  const qGrille = useGrillePrix();
  const qProduits = useProduits();
  const qPrix = useMesPrix();
  const upsertMut = useUpsertPrixLivreur();
  const deleteMut = useSupprimerPrixLivreur();

  const [draftPrix, setDraftPrix] = useState<Record<string, string>>({});
  const [recherche, setRecherche] = useState('');

  const prixMap = useMemo(() => {
    const m = new Map<string, number>();
    if (lectureSeule) {
      for (const l of qGrille.data ?? []) if (l.prix != null) m.set(l.produit.id, Number(l.prix));
    } else {
      for (const p of qPrix.data ?? []) m.set(p.produit.id, p.prix);
    }
    return m;
  }, [lectureSeule, qGrille.data, qPrix.data]);

  const tousProduits = useMemo<ProduitResponse[]>(
    () =>
      lectureSeule
        ? (qGrille.data ?? []).map((l) => ({
            id: l.produit.id,
            code: l.produit.code ?? '',
            designation: l.produit.designation,
            photoUrl: l.produit.photoUrl,
          }))
        : qProduits.data ?? [],
    [lectureSeule, qGrille.data, qProduits.data],
  );

  const produitsAffiches = useMemo(
    () => filtrerRecherche(tousProduits, recherche, (p) => [p.designation, p.code]),
    [tousProduits, recherche],
  );

  if (lectureSeule ? qGrille.isLoading : qProduits.isLoading || qPrix.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  const produits = tousProduits;
  const grilleIndisponible = lectureSeule && qGrille.isError;

  const onSave = (produit: ProduitResponse) => {
    const raw = draftPrix[produit.id] ?? '';
    const prix = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (!prix || prix <= 0) {
      dialog.error('Erreur', 'Saisis un prix supérieur à 0');
      return;
    }
    upsertMut.mutate(
      { produitId: produit.id, prix },
      {
        onSuccess: () => {
          setDraftPrix((d) => ({ ...d, [produit.id]: '' }));
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          dialog.error('Erreur', e.response?.data?.message ?? 'Échec');
        },
      },
    );
  };

  const onDelete = (produit: ProduitResponse) => {
    dialog.confirm({
      title: 'Supprimer ce prix ?',
      message: `Tu n'auras plus de prix par défaut pour ${produit.designation} — il faudra le saisir manuellement à chaque livraison.`,
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () => deleteMut.mutate(produit.id),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes prix de vente"
        subtitle={lectureSeule ? 'Prix fixés par ton responsable' : 'Barème par défaut'}
      />

      {/* FormScreen : le clavier numérique ne recouvre pas les prix du bas. */}
      <FormScreen
        refreshControl={
          <RefreshControl
            refreshing={lectureSeule ? qGrille.isFetching && !qGrille.isLoading : qPrix.isFetching && !qPrix.isLoading}
            onRefresh={() => {
              if (lectureSeule) {
                qGrille.refetch();
                return;
              }
              qPrix.refetch();
              qProduits.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Banner info */}
          <View className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-md p-3 flex-row items-start gap-2 mb-3">
            <Tag color="#059669" size={14} />
            <Text className="flex-1 text-[12px] text-emerald-700 dark:text-emerald-400">
              {lectureSeule
                ? 'Prix fixés par ton responsable. Ils s’appliquent à tes ventes et ne se modifient pas ici.'
                : "Ces prix s'appliquent à toutes tes livraisons. Tu peux les modifier à tout moment — ils sont aussi visibles sur le portail web. Pour un prix spécifique à un client, va sur sa fiche client."}
            </Text>
          </View>

          {produits.length > 0 ? (
            <SearchInput
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Rechercher un produit…"
              className="mb-3"
            />
          ) : null}

          {grilleIndisponible ? (
            <EmptyState
              title="Grille de prix indisponible"
              message="Les prix n’ont pas pu être lus. Tire pour réessayer."
            />
          ) : produits.length === 0 ? (
            <EmptyState
              title="Aucun produit"
              message={
                lectureSeule
                  ? 'Ton responsable n’a pas encore de produit dans son catalogue.'
                  : "Demande à l'admin de créer des produits dans le référentiel."
              }
            />
          ) : produitsAffiches.length === 0 ? (
            <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">
              {AUCUN_RESULTAT}
            </Text>
          ) : (
            <View className="gap-2">
              {produitsAffiches.map((produit) => {
                const prixActuel = prixMap.get(produit.id);
                const draft = draftPrix[produit.id] ?? '';
                const hasPrix = prixActuel !== undefined;

                return (
                  <View
                    key={produit.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3"
                  >
                    {/* Header: vignette + designation + statut */}
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="mr-3">
                        <ProduitVignette
                          designation={produit.designation}
                          photoUrl={produit.photoUrl}
                          size={40}
                        />
                      </View>
                      <View className="flex-1 pr-2">
                        <Text className="font-extrabold text-slate-900 dark:text-white">
                          {produit.designation}
                        </Text>
                        {produit.code ? (
                          <Text className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {produit.code}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Prix actuel */}
                    {hasPrix ? (
                      <View className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-md p-2.5 flex-row items-center justify-between mb-2">
                        <Text className="text-[12px] text-emerald-700 dark:text-emerald-400">
                          Prix de vente actuel
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="font-extrabold text-emerald-700 dark:text-emerald-400">
                            {formatFCFA(prixActuel)} FCFA
                          </Text>
                          {!lectureSeule ? (
                          <Pressable
                            onPress={() => onDelete(produit)}
                            disabled={deleteMut.isPending}
                            hitSlop={6}
                            className="active:opacity-60 p-1"
                          >
                            <Trash2 color="#ef4444" size={16} />
                          </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ) : null}

                    {lectureSeule && !hasPrix ? (
                      <Text className="text-[12px] text-slate-500 dark:text-slate-400">Aucun prix fixé</Text>
                    ) : null}

                    {/* Input + bouton enregistrer (pas pour le commercial d'organisation) */}
                    {!lectureSeule ? (
                    <View className="flex-row gap-2 items-end">
                      <View className="flex-1">
                        <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          {hasPrix ? 'Modifier le prix' : 'Définir un prix'}
                        </Text>
                        <TextInput
                          value={draft}
                          onChangeText={(v) =>
                            setDraftPrix((d) => ({ ...d, [produit.id]: v }))
                          }
                          keyboardType="number-pad"
                          selectTextOnFocus
                          placeholder={hasPrix ? String(prixActuel) : '0'}
                          placeholderTextColor="#94a3b8"
                          className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white text-base"
                        />
                      </View>
                      <Pressable
                        onPress={() => onSave(produit)}
                        disabled={!draft.trim() || upsertMut.isPending}
                        className={`flex-row items-center gap-1.5 px-3 py-2.5 rounded-md ${
                          !draft.trim()
                            ? 'bg-slate-200 dark:bg-slate-800'
                            : 'bg-emerald-500 active:opacity-80'
                        }`}
                      >
                        <Save
                          color={!draft.trim() ? '#94a3b8' : '#ffffff'}
                          size={14}
                        />
                        <Text
                          className={`text-[12px] font-bold ${
                            !draft.trim() ? 'text-slate-400' : 'text-white'
                          }`}
                        >
                          Enregistrer
                        </Text>
                      </Pressable>
                    </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </FormScreen>
    </View>
  );
}
