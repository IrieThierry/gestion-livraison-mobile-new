import { useState, useMemo, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { dialog } from '../../../lib/dialog';
import { X } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useEnregistrerRetour } from '../../../features/retours/hooks';
import { qteRetournable, valeurRetour } from '../../../features/retours/api';
import {
  MESSAGE_DESTINATION_RETOUR,
  regrouperRetours,
  retoursSansDestination,
  type SaisieRetours,
} from '../../../features/livraisons/regles';
import { DestinationRetourToggle } from '../../../components/livreur/DestinationRetourToggle';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatFCFA, formatDateShort } from '../../../lib/format';
import { num } from '../../../features/encaissements/regles';
import type { LivraisonResponse } from '../../../types/api';

/**
 * Formulaire "Retour client".
 *
 * Cible du raccourci "Retour client" du FAB de l'écran tournée. L'utilisateur
 * choisit une livraison récente (30j, ayant encore des lignes retournables),
 * saisit les quantités rapportées par ligne, choisit pour chacune « Remettre
 * en stock » ou « Perdu », puis valide.
 *
 * Côté back, `POST /retour` (une transaction, sans modifier la livraison) :
 * écriture du journal des retours et des cumuls de la livraison,
 * ré-incrémentation du stock du livreur de la seule part remise en stock,
 * baisse du dû du client de (prix + remise) × quantité. Autorisé même sur une
 * livraison entièrement payée (le surplus payé devient une avance). Un refus
 * (400) ou un retour concurrent (409) s'affiche avec le message du back.
 */
export default function RetourClient() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const livreurId = user?.id ?? '';
  const q = useLivraisonsByLivreur(livreurId);
  const m = useEnregistrerRetour();
  // Garde synchrone contre le double appui.
  const submittingRef = useRef(false);

  const [livraisonId, setLivraisonId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qtes, setQtes] = useState<SaisieRetours>({});

  // Pull-to-refresh : recharge la liste des livraisons retournables. Utile
  // si une livraison vient d'être créée ou si un retour a été annulé/modifié
  // côté admin pendant que ce form est ouvert.
  const onRefresh = () => q.refetch();

  // Livraisons des 30 derniers jours qui ont au moins une ligne retournable
  // (qteLivre - qteRetourne > 0). Encaissée ou non : une livraison payée reste
  // modifiable pour ses retours (le back recalcule le dû et le stock).
  const candidates = useMemo<LivraisonResponse[]>(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 86400000);
    return (q.data ?? [])
      .filter((l) => new Date(l.date) >= cutoff)
      .filter((l) => (l.produitsLivraison ?? []).some((p) => qteRetournable(p) > 0))
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
    return (selected.produitsLivraison ?? []).reduce(
      (acc, p) => acc + valeurRetour(p, qtes[p.id]?.qte ?? 0),
      0,
    );
  }, [selected, qtes]);

  if (!user) return null;

  const sansDestination = retoursSansDestination(qtes) > 0;

  const onChangeQte = (produitLivraisonId: string, raw: string) => {
    const n = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
    setQtes((s) => ({
      ...s,
      [produitLivraisonId]: { qte: Math.max(0, n), enStock: s[produitLivraisonId]?.enStock ?? null },
    }));
  };

  const onChangeEnStock = (produitLivraisonId: string, enStock: boolean) => {
    setQtes((s) => ({
      ...s,
      [produitLivraisonId]: { qte: s[produitLivraisonId]?.qte ?? 0, enStock },
    }));
  };

  const onSubmit = () => {
    if (submittingRef.current || m.isPending) return;
    if (!selected) {
      dialog.warning('Champ requis', 'Choisis une livraison');
      return;
    }
    if (!isOnline) {
      dialog.warning('Hors ligne', 'Reconnecte-toi pour enregistrer le retour.');
      return;
    }
    const groupes = regrouperRetours([selected], qtes);
    if (!groupes.ok) {
      dialog.warning('Destination du retour', groupes.erreur);
      return;
    }
    const maxParLigne = new Map(
      (selected.produitsLivraison ?? []).map((p) => [p.id, qteRetournable(p)]),
    );
    const lignes = (groupes.valeur[0]?.lignes ?? []).map((l) => ({
      ...l,
      max: maxParLigne.get(l.produitLivraisonId) ?? 0,
    }));

    if (lignes.length === 0) {
      dialog.warning('Aucune ligne', 'Aucune quantité à retourner');
      return;
    }
    const overflow = lignes.find((l) => l.quantite > l.max);
    if (overflow) {
      dialog.warning(
        'Quantité invalide',
        `Quantité dépasse le maximum (${overflow.max})`,
      );
      return;
    }

    submittingRef.current = true;
    m.mutate(
      {
        livraisonId: selected.id,
        lignes: lignes.map((l) => ({
          produitLivraisonId: l.produitLivraisonId,
          quantite: l.quantite,
          remisEnStock: l.remettreEnStock,
        })),
      },
      {
        onSuccess: () => {
          setLivraisonId(null);
          setQtes({});
          router.back();
          dialog.success('Retour enregistré', 'Stock et dû du client mis à jour');
        },
        onError: (err: unknown) => {
          dialog.error('Erreur', extractApiErrorMessage(err, 'Échec de l’enregistrement'));
        },
        onSettled: () => {
          submittingRef.current = false;
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
                  const max = qteRetournable(p);
                  const qty = qtes[p.id]?.qte ?? 0;
                  const enStock = qtes[p.id]?.enStock ?? null;
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
                          <>
                            <Text className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {formatFCFA(valeurRetour(p, qty))} FCFA déduit (estimation)
                            </Text>
                            <DestinationRetourToggle
                              enStock={enStock}
                              onChange={(v) => onChangeEnStock(p.id, v)}
                            />
                          </>
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
                  Total retour (estimation)
                </Text>
                <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatFCFA(totalRetour)} FCFA
                </Text>
              </View>

              {sansDestination ? (
                <Text className="text-[12px] text-amber-700 dark:text-amber-400 font-bold mt-3">
                  {MESSAGE_DESTINATION_RETOUR}
                </Text>
              ) : null}

              {/* Submit */}
              <Pressable
                onPress={onSubmit}
                disabled={m.isPending || !isOnline || sansDestination}
                className={`rounded-md py-3.5 mt-5 items-center ${
                  !isOnline || sansDestination
                    ? 'bg-slate-200 dark:bg-slate-800'
                    : 'bg-emerald-500 active:opacity-80'
                }`}
              >
                {m.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    className={`font-bold text-base ${
                      !isOnline || sansDestination ? 'text-slate-400' : 'text-white'
                    }`}
                  >
                    {sansDestination && isOnline
                      ? 'Destination du retour à choisir'
                      : !isOnline
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
                  dû {formatFCFA(num(item.montantDu))} FCFA ·{' '}
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
