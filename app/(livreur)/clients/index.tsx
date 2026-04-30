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
import { computeEncoursForClient, computeSoldeForClient } from '../../../lib/credit';
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
    const data = q.data ?? [];
    if (!search.trim()) return data;
    const needle = search.toLowerCase();
    return data.filter(
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
    const livraisons = qLiv.data ?? [];
    const pending = livraisons.filter(
      (l) => l.client.id === client.id && l.statut !== 'ENCAISSEE',
    );
    if (pending.length === 0) {
      Alert.alert(
        'Rien à encaisser',
        `Aucune livraison en attente pour ${client.prenom} ${client.nom}.`,
      );
      return;
    }
    if (pending.length === 1) {
      router.push({
        pathname: '/(livreur)/cash/encaisser' as never,
        params: { livraisonId: pending[0].id },
      } as never);
      return;
    }
    // Multiple pending: choose latest, or open the full list filtered.
    const sorted = [...pending].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    Alert.alert(
      `${pending.length} livraisons à encaisser`,
      `${client.prenom} ${client.nom} a ${pending.length} livraisons en attente. Encaisser la plus récente ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Voir toutes',
          onPress: () => router.push('/(livreur)/livraisons' as never),
        },
        {
          text: 'Plus récente',
          onPress: () =>
            router.push({
              pathname: '/(livreur)/cash/encaisser' as never,
              params: { livraisonId: sorted[0].id },
            } as never),
        },
      ],
    );
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
          const pending = livraisons.filter(
            (l) => l.client.id === item.id && l.statut !== 'ENCAISSEE',
          );
          const encours = computeEncoursForClient(livraisons, item.id);
          const solde = computeSoldeForClient(livraisons, encaissements, item.id);
          return (
            <ClientRow
              client={item}
              geo={geo}
              pendingCount={pending.length}
              encours={encours}
              solde={solde}
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
  pendingCount,
  encours,
  solde,
  onLivrer,
  onEncaisser,
}: {
  client: ClientResponse;
  geo: { lat: number; lng: number } | null;
  pendingCount: number;
  encours: number;
  solde: number;
  onLivrer: () => void;
  onEncaisser: () => void;
}) {
  const initials = `${client.prenom[0] ?? ''}${client.nom[0] ?? ''}`.toUpperCase();
  // border / amount color follow the SIGNED solde
  const debt = solde > 0;
  const credit = solde < 0;

  return (
    <View
      className={`bg-white dark:bg-slate-900 border rounded-lg p-3 mb-2 ${
        debt
          ? 'border-slate-200 dark:border-slate-800 border-l-4 border-l-red-500'
          : credit
            ? 'border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500'
            : 'border-slate-200 dark:border-slate-800'
      }`}
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
          {encours > 0 ? (
            <Text className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
              Encours · {formatFCFA(encours)} F · {pendingCount} livr.
            </Text>
          ) : null}
        </View>
        <View className="items-end">
          {debt ? (
            <>
              <Text className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 tracking-wider">
                Solde dû
              </Text>
              <Text className="font-extrabold text-red-600 dark:text-red-400 text-sm">
                {formatFCFA(solde)} F
              </Text>
            </>
          ) : credit ? (
            <>
              <Text className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                Avoir
              </Text>
              <Text className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                {formatFCFA(Math.abs(solde))} F
              </Text>
            </>
          ) : (
            <View className="bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                À jour
              </Text>
            </View>
          )}
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
    </View>
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

