import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Save, Trash2, Tag } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useProduits } from '../../../features/produits/hooks';
import {
  useMesPrix,
  useUpsertPrixLivreur,
  useSupprimerPrixLivreur,
} from '../../../features/prix/hooks';
import { formatFCFA } from '../../../lib/format';
import type { ProduitResponse } from '../../../types/api';

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
  const qProduits = useProduits();
  const qPrix = useMesPrix();
  const upsertMut = useUpsertPrixLivreur();
  const deleteMut = useSupprimerPrixLivreur();

  const [draftPrix, setDraftPrix] = useState<Record<string, string>>({});

  const prixMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of qPrix.data ?? []) m.set(p.produit.id, p.prix);
    return m;
  }, [qPrix.data]);

  if (qProduits.isLoading || qPrix.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  const produits = qProduits.data ?? [];

  const onSave = (produit: ProduitResponse) => {
    const raw = draftPrix[produit.id] ?? '';
    const prix = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (!prix || prix <= 0) {
      Alert.alert('Erreur', 'Saisis un prix supérieur à 0');
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
          Alert.alert('Erreur', e.response?.data?.message ?? 'Échec');
        },
      },
    );
  };

  const onDelete = (produit: ProduitResponse) => {
    Alert.alert(
      'Supprimer ce prix ?',
      `Tu n'auras plus de prix par défaut pour ${produit.designation} — il faudra le saisir manuellement à chaque livraison.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteMut.mutate(produit.id),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes prix de vente"
        subtitle="Barème par défaut"
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={qPrix.isFetching && !qPrix.isLoading}
            onRefresh={() => {
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
              Ces prix s'appliquent à toutes tes livraisons. Tu peux les
              modifier à tout moment — ils sont aussi visibles sur le portail
              web. Pour un prix spécifique à un client, va sur sa fiche client.
            </Text>
          </View>

          {produits.length === 0 ? (
            <EmptyState
              title="Aucun produit"
              message="Demande à l'admin de créer des produits dans le référentiel."
            />
          ) : (
            <View className="gap-2">
              {produits.map((produit) => {
                const prixActuel = prixMap.get(produit.id);
                const draft = draftPrix[produit.id] ?? '';
                const hasPrix = prixActuel !== undefined;

                return (
                  <View
                    key={produit.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3"
                  >
                    {/* Header: designation + statut */}
                    <View className="flex-row items-center justify-between mb-2">
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
                      {produit.prixAchatParDefaut > 0 ? (
                        <Text className="text-[10px] text-slate-400 dark:text-slate-500">
                          PA: {formatFCFA(produit.prixAchatParDefaut)}
                        </Text>
                      ) : null}
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
                          <Pressable
                            onPress={() => onDelete(produit)}
                            disabled={deleteMut.isPending}
                            hitSlop={6}
                            className="active:opacity-60 p-1"
                          >
                            <Trash2 color="#ef4444" size={16} />
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    {/* Input + bouton enregistrer */}
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
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
