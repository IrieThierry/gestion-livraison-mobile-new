import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Plus, Phone, MapPin, Truck, Banknote, Map } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useClientsByLivreur, useEncoursByLivreur } from '../../../features/clients/hooks';
import { indexerEncours, num } from '../../../features/encaissements/regles';
import { useAuthStore } from '../../../stores/authStore';
import { callPhone, navigateTo } from '../../../lib/linking';
import { formatMontant } from '../../../lib/format';
import { extractApiErrorMessage } from '../../../lib/api-error';
import type { ClientResponse, EncoursClientResponse } from '../../../types/api';

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
  // Soldes calculés par le serveur, en un appel.
  const qEncours = useEncoursByLivreur(livreurId);
  const encoursParClient = useMemo(() => indexerEncours(qEncours.data), [qEncours.data]);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    // Tri stable alphabétique par prénom puis nom — l'ordre est figé peu
    // importe ce que renvoie le back (qui peut varier).
    const sorted = [...(q.data ?? [])].sort((a, b) =>
      `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'),
    );
    if (!search.trim()) return sorted;
    const needle = search.toLowerCase();
    return sorted.filter(
      (c) =>
        `${c.prenom} ${c.nom}`.toLowerCase().includes(needle) ||
        (c.quartier?.libelle ?? '').toLowerCase().includes(needle) ||
        (c.contact ?? '').includes(needle),
    );
  }, [q.data, search]);

  if (!user) return null;

  const onLivrer = (client: ClientResponse) => {
    router.push({
      pathname: '/(livreur)/livraisons/nouvelle' as never,
      params: { clientId: client.id },
    } as never);
  };

  const onEncaisser = (client: ClientResponse) => {
    // Page d'encaissement en MODE CLIENT : elle lit le solde du client sur
    // le serveur et pré-remplit le montant.
    router.push({
      pathname: '/(livreur)/cash/encaisser' as never,
      params: { clientId: client.id },
    } as never);
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes clients"
        subtitle={`${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`}
        showBack={false}
        right={
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push('/(livreur)/clients/map' as never)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-70"
            >
              <Map color="#3b82f6" size={14} />
              <Text className="text-slate-700 dark:text-slate-300 text-xs font-bold">
                Carte
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(livreur)/clients/nouveau' as never)}
              className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
            >
              <Plus color="#fff" size={14} />
              <Text className="text-white text-xs font-bold">Nouveau</Text>
            </Pressable>
          </View>
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
        {qEncours.isError ? (
          <Text className="text-[11px] text-red-600 dark:text-red-400 mt-1">
            Soldes indisponibles : {extractApiErrorMessage(qEncours.error, 'réessaye plus tard')}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => {
              q.refetch();
              qEncours.refetch();
            }}
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
            <ClientRow
              client={item}
              geo={geo}
              encours={encoursParClient.get(item.id)}
              soldeIndisponible={qEncours.isError}
              onPress={() =>
                router.push({
                  pathname: '/(livreur)/clients/[id]' as never,
                  params: { id: item.id },
                } as never)
              }
              onLivrer={() => onLivrer(item)}
              onEncaisser={() => onEncaisser(item)}
            />
          );
        }}
      />
    </View>
  );
}

function ClientRow({
  client,
  geo,
  encours,
  soldeIndisponible,
  onPress,
  onLivrer,
  onEncaisser,
}: {
  client: ClientResponse;
  geo: { lat: number; lng: number } | null;
  encours: EncoursClientResponse | undefined;
  soldeIndisponible: boolean;
  onPress: () => void;
  onLivrer: () => void;
  onEncaisser: () => void;
}) {
  const initials = `${client.prenom?.[0] ?? ''}${client.nom?.[0] ?? ''}`.toUpperCase();
  const solde = num(encours?.solde);
  const debt = solde > 0;
  const credit = solde < 0;

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2 active:opacity-80"
    >
      {/* Identity row */}
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
          <Text className="text-emerald-700 dark:text-emerald-400 font-extrabold text-xs">
            {initials || '?'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white">
            {client.prenom} {client.nom}
          </Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            {client.quartier?.libelle ?? '—'}
            {client.contact ? ` · ${client.contact}` : ''}
          </Text>
        </View>
        <View className="items-end gap-0.5">
          {soldeIndisponible ? (
            <Text className="text-[11px] font-bold text-slate-400">—</Text>
          ) : debt ? (
            <View className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15">
              <Text className="text-[11px] font-bold text-amber-800 dark:text-amber-400">
                {formatMontant(solde)} F
              </Text>
            </View>
          ) : credit ? (
            <View className="bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
              <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Avance {formatMontant(Math.abs(solde))} F
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Action row */}
      <View className="flex-row gap-1.5 mt-3">
        <ActionChip
          icon={Phone}
          color="#10b981"
          label="Appeler"
          disabled={!client.contact}
          onPress={() => client.contact && callPhone(client.contact)}
        />
        <ActionChip
          icon={MapPin}
          color="#3b82f6"
          label="Y aller"
          disabled={!geo}
          onPress={() =>
            geo && navigateTo(geo.lat, geo.lng, `${client.prenom} ${client.nom}`)
          }
        />
        <ActionChip
          icon={Truck}
          color="#10b981"
          label="Livrer"
          onPress={onLivrer}
        />
        <ActionChip
          icon={Banknote}
          color="#f59e0b"
          label="Encaisser"
          onPress={onEncaisser}
        />
      </View>
    </Pressable>
  );
}

function ActionChip({
  icon: Icon,
  color,
  label,
  disabled,
  onPress,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      className={`flex-1 flex-row items-center justify-center gap-1 py-2 rounded-md border ${
        disabled
          ? 'border-slate-200 dark:border-slate-800 opacity-40'
          : 'border-slate-200 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800/60'
      }`}
    >
      <Icon color={disabled ? '#94a3b8' : color} size={14} />
      <Text
        className={`text-[10px] font-bold ${
          disabled
            ? 'text-slate-400'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

