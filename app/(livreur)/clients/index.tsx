import { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Plus, Phone, MapPin } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { callPhone, navigateTo } from '../../../lib/linking';

function parseLatLng(s: string | null | undefined): { lat: number; lng: number } | null {
  if (!s) return null;
  const [a, b] = s.split(',').map((p) => parseFloat(p.trim()));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return null;
}

export default function ClientsList() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useClientsByLivreur(livreurId);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const data = q.data ?? [];
    if (!search.trim()) return data;
    const needle = search.toLowerCase();
    return data.filter((c) =>
      `${c.prenom} ${c.nom}`.toLowerCase().includes(needle) ||
      (c.quartier?.libelle ?? '').toLowerCase().includes(needle),
    );
  }, [q.data, search]);

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes clients"
        subtitle={`${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`}
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/clients/nouveau' as never)}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouveau</Text>
          </Pressable>
        }
      />

      <View className="px-4 pb-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un client…"
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
          autoCapitalize="none"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2.5 text-slate-900 dark:text-white text-base"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucun client"
            message={
              search
                ? 'Aucun client ne correspond à ta recherche.'
                : 'Crée ton premier client avec le bouton « Nouveau ».'
            }
          />
        }
        renderItem={({ item }) => {
          const geo = parseLatLng(item.latitudeLongitude);
          return (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mb-2 flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {item.prenom} {item.nom}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  {item.quartier?.libelle ?? '—'}
                  {item.contact ? ` · ${item.contact}` : ''}
                </Text>
              </View>
              <View className="flex-row gap-2">
                {item.contact ? (
                  <Pressable onPress={() => callPhone(item.contact)} hitSlop={6} className="active:opacity-60">
                    <Phone color="#10b981" size={20} />
                  </Pressable>
                ) : null}
                {geo ? (
                  <Pressable
                    onPress={() => navigateTo(geo.lat, geo.lng, `${item.prenom} ${item.nom}`)}
                    hitSlop={6}
                    className="active:opacity-60"
                  >
                    <MapPin color="#3b82f6" size={20} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
