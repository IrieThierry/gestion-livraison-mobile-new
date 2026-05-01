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
import { Plus, Phone, MapPin, Truck, Banknote } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { callPhone, navigateTo } from '../../../lib/linking';
import { formatFCFA } from '../../../lib/format';
import { computeSoldeForClient } from '../../../lib/credit';
import type { ClientResponse } from '../../../types/api';

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
  const qLiv = useLivraisonsByLivreur(livreurId);
  const qEnc = useEncaissementsByLivreur(livreurId);
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
    // On ouvre directement la page d'encaissement en MODE CLIENT — la page
    // agrège elle-même les livraisons non encaissées, calcule le total
    // dû et le solde, et pré-remplit le montant à encaisser. Plus besoin
    // de choisir une livraison spécifique.
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
            onRefresh={() => {
              q.refetch();
              qLiv.refetch();
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
          const livraisons = qLiv.data ?? [];
          const encaissements = qEnc.data ?? [];
          const solde = computeSoldeForClient(livraisons, encaissements, item.id);
          return (
            <ClientRow
              client={item}
              geo={geo}
              solde={solde}
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
  solde,
  onPress,
  onLivrer,
  onEncaisser,
}: {
  client: ClientResponse;
  geo: { lat: number; lng: number } | null;
  solde: number;
  onPress: () => void;
  onLivrer: () => void;
  onEncaisser: () => void;
}) {
  const initials = `${client.prenom[0] ?? ''}${client.nom[0] ?? ''}`.toUpperCase();
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
        {debt ? (
          <View className="bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-full">
            <Text className="text-[11px] font-bold text-amber-800 dark:text-amber-400">
              {formatFCFA(solde)} F
            </Text>
          </View>
        ) : credit ? (
          <View className="bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
            <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              +{formatFCFA(Math.abs(solde))} F
            </Text>
          </View>
        ) : null}
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

