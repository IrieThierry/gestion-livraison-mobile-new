import { useMemo } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { Plus, Trash2, Fuel, Wrench, FileText, MoreHorizontal } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { useDepenses, useDeleteDepense } from '../../../../features/depenses/hooks';
import { formatFCFA, formatDateShort } from '../../../../lib/format';
import type { DepenseResponse } from '../../../../types/api';

const CATEGORIE_META: Record<
  string,
  { icon: React.ComponentType<{ color: string; size: number }>; color: string; bg: string; label: string }
> = {
  CARBURANT: { icon: Fuel, color: '#dc2626', bg: 'bg-red-100 dark:bg-red-500/15', label: 'Carburant' },
  ENTRETIEN: { icon: Wrench, color: '#3b82f6', bg: 'bg-blue-100 dark:bg-blue-500/15', label: 'Entretien' },
  ADMINISTRATIF: { icon: FileText, color: '#8b5cf6', bg: 'bg-violet-100 dark:bg-violet-500/15', label: 'Administratif' },
  AUTRE: { icon: MoreHorizontal, color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800', label: 'Autre' },
};

export default function DepensesList() {
  const q = useDepenses();
  const m = useDeleteDepense();

  const total = useMemo(
    () => (q.data ?? []).reduce((acc, d) => acc + (d.montant ?? 0), 0),
    [q.data],
  );

  // Tri stable : plus récent en premier
  const sorted = useMemo(
    () =>
      [...(q.data ?? [])].sort(
        (a, b) =>
          new Date(b.dateDepense).getTime() - new Date(a.dateDepense).getTime(),
      ),
    [q.data],
  );

  const onDelete = (d: DepenseResponse) => {
    Alert.alert('Supprimer cette dépense ?', d.libelle, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => m.mutate(d.id) },
    ]);
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes dépenses"
        subtitle={`${q.data?.length ?? 0} dépense${(q.data?.length ?? 0) > 1 ? 's' : ''} · ${formatFCFA(total)} FCFA`}
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/cash/depenses/nouvelle' as never)}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouvelle</Text>
          </Pressable>
        }
      />

      <FlatList
        data={sorted}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucune dépense"
            message="Enregistre tes frais de tournée (carburant, entretien…) avec le bouton « Nouvelle »."
          />
        }
        renderItem={({ item }) => {
          const meta = CATEGORIE_META[item.categorie] ?? CATEGORIE_META.AUTRE;
          const Icon = meta.icon;
          return (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2 flex-row items-center gap-3">
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${meta.bg}`}
              >
                <Icon color={meta.color} size={16} />
              </View>
              <View className="flex-1">
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {item.libelle}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {meta.label} · {formatDateShort(item.dateDepense)}
                  {item.commentaire ? ` · ${item.commentaire}` : ''}
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {formatFCFA(item.montant)}
                </Text>
                <Text className="text-[10px] text-slate-400 dark:text-slate-500">FCFA</Text>
              </View>
              <Pressable
                onPress={() => onDelete(item)}
                hitSlop={6}
                className="active:opacity-60 p-1"
              >
                <Trash2 color="#ef4444" size={14} />
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}
