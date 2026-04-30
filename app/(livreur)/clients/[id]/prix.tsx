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
import { useLocalSearchParams } from 'expo-router';
import { Save, Trash2, Tag, User } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { useClientsByLivreur } from '../../../../features/clients/hooks';
import { useProduits } from '../../../../features/produits/hooks';
import {
  useMesPrix,
  usePrixClient,
  useUpsertPrixClient,
  useSupprimerPrixClient,
} from '../../../../features/prix/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { formatFCFA } from '../../../../lib/format';
import type { ProduitResponse } from '../../../../types/api';

/**
 * Gestion des prix custom pour un client donné.
 *
 * Chaque produit du catalogue affiche :
 *   - Pastille verte 🟢 si un prix CLIENT custom existe → input pré-rempli
 *     + bouton 🗑 pour supprimer (le client retomberait sur le prix livreur).
 *   - Pastille bleue 🔵 si aucun prix custom mais un prix LIVREUR par défaut
 *     hérité → indication de la source + champ vide pour override.
 *   - Pastille grise ⚪ si aucun prix défini → champ vide pour définir le 1er.
 *
 * On utilise les mêmes endpoints que la dialog `PrixClientDialog` du portail
 * web — ce qui rend les changements immédiatement visibles côté admin/web.
 */
export default function PrixClientPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const qC = useClientsByLivreur(livreurId);
  const qProduits = useProduits();
  const qPrixClient = usePrixClient(id);
  const qPrixLivreur = useMesPrix();
  const upsertMut = useUpsertPrixClient();
  const deleteMut = useSupprimerPrixClient();

  const [draftPrix, setDraftPrix] = useState<Record<string, string>>({});

  const client = useMemo(
    () => (qC.data ?? []).find((c) => c.id === id),
    [qC.data, id],
  );

  // Maps O(1) pour les lookups par produitId
  const prixClientMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of qPrixClient.data ?? []) m.set(p.produit.id, p.prix);
    return m;
  }, [qPrixClient.data]);

  const prixLivreurMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of qPrixLivreur.data ?? []) m.set(p.produit.id, p.prix);
    return m;
  }, [qPrixLivreur.data]);

  if (!user) return null;

  if (qC.isLoading || qProduits.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  if (!client) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Prix client" />
        <EmptyState
          title="Client introuvable"
          message="Ce client n'est plus dans ta liste."
        />
      </View>
    );
  }

  const fullName = `${client.prenom} ${client.nom}`.trim();
  const produits = qProduits.data ?? [];

  const onSave = (produit: ProduitResponse) => {
    const raw = draftPrix[produit.id] ?? '';
    const prix = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (!prix || prix <= 0) {
      Alert.alert('Erreur', 'Saisis un prix supérieur à 0');
      return;
    }
    upsertMut.mutate(
      { clientId: client.id, produitId: produit.id, prix },
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
      `${produit.designation} retombera sur le prix par défaut.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () =>
            deleteMut.mutate({ clientId: client.id, produitId: produit.id }),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Prix personnalisés" subtitle={fullName} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={qPrixClient.isFetching && !qPrixClient.isLoading}
            onRefresh={() => {
              qPrixClient.refetch();
              qPrixLivreur.refetch();
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
              Les prix mémorisés ici remplacent ton barème par défaut pour ce
              client uniquement. Ils sont visibles aussi sur le portail web.
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
                const prixCustom = prixClientMap.get(produit.id);
                const prixDefaut = prixLivreurMap.get(produit.id);
                const draft = draftPrix[produit.id] ?? '';

                let badgeColor = '#94a3b8';
                let badgeBg = 'bg-slate-100 dark:bg-slate-800';
                let badgeLabel = 'Aucun prix';
                if (prixCustom !== undefined) {
                  badgeColor = '#059669';
                  badgeBg = 'bg-emerald-100 dark:bg-emerald-500/15';
                  badgeLabel = 'Prix custom';
                } else if (prixDefaut !== undefined) {
                  badgeColor = '#3b82f6';
                  badgeBg = 'bg-blue-100 dark:bg-blue-500/15';
                  badgeLabel = 'Hérité livreur';
                }

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
                      <View
                        className={`${badgeBg} px-2 py-0.5 rounded-full flex-row items-center gap-1`}
                      >
                        <View
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: badgeColor }}
                        />
                        <Text
                          className="text-[10px] font-bold"
                          style={{ color: badgeColor }}
                        >
                          {badgeLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Prix custom existant */}
                    {prixCustom !== undefined ? (
                      <View className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-md p-2.5 flex-row items-center justify-between mb-2">
                        <Text className="text-[12px] text-emerald-700 dark:text-emerald-400">
                          Prix négocié pour ce client
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="font-extrabold text-emerald-700 dark:text-emerald-400">
                            {formatFCFA(prixCustom)} FCFA
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

                    {/* Prix livreur hérité */}
                    {prixCustom === undefined && prixDefaut !== undefined ? (
                      <View className="flex-row items-center gap-1.5 mb-2">
                        <User color="#3b82f6" size={11} />
                        <Text className="text-[11px] text-blue-600 dark:text-blue-400">
                          Prix par défaut livreur :{' '}
                          <Text className="font-bold">{formatFCFA(prixDefaut)} FCFA</Text>
                        </Text>
                      </View>
                    ) : null}

                    {/* Input + bouton enregistrer */}
                    <View className="flex-row gap-2 items-end">
                      <View className="flex-1">
                        <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          {prixCustom !== undefined
                            ? 'Modifier le prix'
                            : 'Définir un prix custom'}
                        </Text>
                        <TextInput
                          value={draft}
                          onChangeText={(v) =>
                            setDraftPrix((d) => ({ ...d, [produit.id]: v }))
                          }
                          keyboardType="number-pad"
                          selectTextOnFocus
                          placeholder={
                            prixCustom !== undefined
                              ? String(prixCustom)
                              : prixDefaut !== undefined
                              ? `Hérite de ${prixDefaut}`
                              : '0'
                          }
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
