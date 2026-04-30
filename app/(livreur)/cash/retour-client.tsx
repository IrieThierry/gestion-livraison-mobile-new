import { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useEnregistrerRetour } from '../../../features/retours/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { formatFCFA, formatDateShort } from '../../../lib/format';
import type { LivraisonResponse } from '../../../types/api';

type ReturnQty = Record<string, number>; // produitLivraisonId -> quantité retournée

/**
 * Formulaire "Retour client" (Plan D).
 *
 * Cible du raccourci "Retour client" du FAB de l'écran tournée. L'utilisateur
 * choisit une livraison récente (30j, ayant encore des lignes retournables),
 * saisit les quantités à rapporter par ligne, puis valide.
 *
 * Côté back, on envoie un `PUT /livraison` (le back ne fournit pas
 * d'endpoint dédié `/retour-client` ; cf. plan D — `ModifierLivraisonUseCase`
 * orchestre dans la même transaction la mise à jour des `qteRetournee`,
 * la ré-incrémentation du stock courant livreur et la déduction du solde
 * client).
 */
export default function RetourClient() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const livreurId = user?.id ?? '';
  const q = useLivraisonsByLivreur(livreurId);
  const m = useEnregistrerRetour();

  const [livraisonId, setLivraisonId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qtes, setQtes] = useState<ReturnQty>({});

  // Pull-to-refresh : recharge la liste des livraisons retournables. Utile
  // si une livraison vient d'être créée ou si un retour a été annulé/modifié
  // côté admin pendant que ce form est ouvert.
  const onRefresh = () => q.refetch();

  // Livraisons des 30 derniers jours qui ont au moins une ligne retournable
  // (qteLivre - qteRetourne > 0). On accepte tous statuts (LIVREE et ENCAISSEE
  // peuvent recevoir un retour ; le back ré-ajuste le solde et le stock).
  const candidates = useMemo<LivraisonResponse[]>(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 86400000);
    return (q.data ?? [])
      .filter((l) => new Date(l.date) >= cutoff)
      .filter((l) =>
        (l.produitsLivraison ?? []).some(
          (p) => (p.qteLivre ?? 0) - (p.qteRetourne ?? 0) > 0,
        ),
      )
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
  }, [q.data]);

  const selected: LivraisonResponse | undefined = useMemo(
    () => (q.data ?? []).find((l) => l.id === livraisonId),
    [q.data, livraisonId],
  );

  const totalRetour = useMemo(() => {
    if (!selected) return 0;
    return (selected.produitsLivraison ?? []).reduce((acc, p) => {
      const qty = qtes[p.id] ?? 0;
      return acc + qty * (p.prixDeVente ?? 0);
    }, 0);
  }, [selected, qtes]);

  if (!user) return null;

  const onChangeQte = (produitLivraisonId: string, raw: string) => {
    const n = parseInt(raw, 10) || 0;
    setQtes((s) => ({ ...s, [produitLivraisonId]: Math.max(0, n) }));
  };

  const onSubmit = () => {
    if (!selected) {
      Alert.alert('Erreur', 'Choisis une livraison');
      return;
    }
    const lignes = (selected.produitsLivraison ?? [])
      .map((p) => ({
        produitLivraisonId: p.id,
        quantite: qtes[p.id] ?? 0,
        max: (p.qteLivre ?? 0) - (p.qteRetourne ?? 0),
      }))
      .filter((l) => l.quantite > 0);

    if (lignes.length === 0) {
      Alert.alert('Erreur', 'Aucune quantité à retourner');
      return;
    }
    const overflow = lignes.find((l) => l.quantite > l.max);
    if (overflow) {
      Alert.alert(
        'Erreur',
        `Quantité dépasse le maximum (${overflow.max})`,
      );
      return;
    }

    m.mutate(
      {
        livraison: selected,
        request: {
          livraisonId: selected.id,
          lignes: lignes.map((l) => ({
            produitLivraisonId: l.produitLivraisonId,
            quantite: l.quantite,
          })),
        },
      },
      {
        onSuccess: () => {
          setLivraisonId(null);
          setQtes({});
          router.back();
          Alert.alert(
            'Succès',
            'Retour enregistré, stock et solde client mis à jour',
          );
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert(
            'Erreur',
            e.response?.data?.message ?? 'Échec de l’enregistrement',
          );
        },
      },
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Retour client" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4">
          {/* Livraison picker */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Livraison source
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-3.5 active:opacity-70"
          >
            <Text
              className={
                selected
                  ? 'text-slate-900 dark:text-white text-base'
                  : 'text-slate-400 text-base'
              }
            >
              {selected
                ? `${selected.client.prenom} ${selected.client.nom} · ${formatDateShort(selected.date)}`
                : 'Choisir une livraison récente'}
            </Text>
          </Pressable>

          {/* Lignes editor */}
          {selected ? (
            <>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
                Quantités à retourner
              </Text>
              <View className="gap-2">
                {(selected.produitsLivraison ?? []).map((p) => {
                  const max = (p.qteLivre ?? 0) - (p.qteRetourne ?? 0);
                  const qty = qtes[p.id] ?? 0;
                  return (
                    <View
                      key={p.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-2"
                    >
                      <View className="flex-1">
                        <Text className="font-extrabold text-slate-900 dark:text-white">
                          {p.produit.designation}
                        </Text>
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          Livré {p.qteLivre} · Déjà retourné {p.qteRetourne} ·
                          Max retournable {max}
                        </Text>
                        {qty > 0 ? (
                          <Text className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {formatFCFA((p.prixDeVente ?? 0) * qty)} FCFA déduit
                          </Text>
                        ) : null}
                      </View>
                      <TextInput
                        value={qty ? String(qty) : ''}
                        onChangeText={(v) => onChangeQte(p.id, v)}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                        editable={max > 0}
                        className={`w-16 px-2 py-2 rounded text-center text-slate-900 dark:text-white border ${
                          qty > max
                            ? 'border-red-500 bg-red-50 dark:bg-red-500/10'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                        } ${max === 0 ? 'opacity-40' : ''}`}
                      />
                    </View>
                  );
                })}
              </View>

              {/* Total */}
              <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-4 flex-row justify-between">
                <Text className="font-bold text-slate-700 dark:text-slate-300">
                  Total retour
                </Text>
                <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatFCFA(totalRetour)} FCFA
                </Text>
              </View>

              {/* Submit */}
              <Pressable
                onPress={onSubmit}
                disabled={m.isPending || !isOnline}
                className={`rounded-md py-3.5 mt-5 items-center ${
                  !isOnline
                    ? 'bg-slate-200 dark:bg-slate-800'
                    : 'bg-emerald-500 active:opacity-80'
                }`}
              >
                {m.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    className={`font-bold text-base ${
                      !isOnline ? 'text-slate-400' : 'text-white'
                    }`}
                  >
                    {!isOnline
                      ? 'Hors ligne — réessaye en ligne'
                      : 'Enregistrer le retour'}
                  </Text>
                )}
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Picker modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
        presentationStyle="pageSheet"
      >
        <View className="flex-1 bg-slate-50 dark:bg-slate-950 pt-4 px-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
              Livraisons récentes (30j)
            </Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
              <X color="#64748b" size={22} />
            </Pressable>
          </View>
          <FlatList
            data={candidates}
            keyExtractor={(l) => l.id}
            ListEmptyComponent={
              <View className="mt-12">
                <EmptyState
                  title="Aucune livraison retournable"
                  message="Les livraisons des 30 derniers jours encore retournables apparaitront ici."
                />
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setLivraisonId(item.id);
                  setQtes({});
                  setPickerOpen(false);
                }}
                className="py-3 border-b border-slate-200 dark:border-slate-800 active:opacity-60"
              >
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {item.client.prenom} {item.client.nom}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatDateShort(item.date)} ·{' '}
                  {formatFCFA(item.montantLivre)} FCFA ·{' '}
                  {item.produitsLivraison?.length ?? 0} ligne(s)
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
