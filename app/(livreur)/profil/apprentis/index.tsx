import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Plus, UsersRound, Power, ChevronRight } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  useApprentis,
  useToggleApprentiActif,
} from '../../../../features/apprentis/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import type { LivreurResponse } from '../../../../types/api';

/**
 * « Mes apprentis » — page accessible depuis le Profil pour les livreurs
 * racines uniquement (parentId = null). Liste les apprentis rattachés,
 * permet d'en créer un nouveau et d'activer/désactiver un compte.
 *
 * Tap sur une ligne → fiche apprenti avec drill-in vers ses livraisons
 * et clients.
 */
export default function ApprentisList() {
  const user = useAuthStore((s) => s.user);
  const q = useApprentis();
  const toggleMut = useToggleApprentiActif();
  const [search, setSearch] = useState('');

  const isRoot =
    !!user && user.role === 'LIVREUR' && (user.parentId ?? null) === null;

  const filtered = useMemo(() => {
    // Tri stable alphabétique par prénom puis nom
    const sorted = [...(q.data ?? [])].sort((a, b) =>
      `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'),
    );
    if (!search.trim()) return sorted;
    const needle = search.toLowerCase();
    return sorted.filter(
      (a) =>
        `${a.prenom} ${a.nom}`.toLowerCase().includes(needle) ||
        (a.username ?? '').toLowerCase().includes(needle) ||
        (a.contact ?? '').includes(needle),
    );
  }, [q.data, search]);

  if (!user) return null;

  // Garde-fou : si l'utilisateur n'est pas un livreur racine, on ne devrait
  // jamais arriver ici (le menu Profil n'expose pas le lien). Au cas où,
  // affiche un message clair.
  if (!isRoot) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Mes apprentis" />
        <EmptyState
          title="Réservé aux livreurs racines"
          message="Seuls les livreurs sans parent peuvent gérer des apprentis."
        />
      </View>
    );
  }

  const onToggle = (a: LivreurResponse) => {
    const next = !a.actif;
    Alert.alert(
      next ? 'Activer le compte ?' : 'Désactiver le compte ?',
      next
        ? `${a.prenom} ${a.nom} pourra à nouveau se connecter.`
        : `${a.prenom} ${a.nom} ne pourra plus se connecter tant que tu ne réactives pas son compte.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: next ? 'Activer' : 'Désactiver',
          style: next ? 'default' : 'destructive',
          onPress: () => toggleMut.mutate({ id: a.id, actif: next }),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes apprentis"
        subtitle={`${q.data?.length ?? 0} apprenti${(q.data?.length ?? 0) > 1 ? 's' : ''}`}
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/profil/apprentis/nouveau' as never)}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouveau</Text>
          </Pressable>
        }
      />

      {/* Recherche */}
      {(q.data?.length ?? 0) > 0 ? (
        <View className="px-4 pb-2">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un apprenti…"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            autoCapitalize="none"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2.5 text-slate-900 dark:text-white text-base"
          />
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : (
            <EmptyState
              title="Aucun apprenti"
              message={
                search
                  ? 'Aucun apprenti ne correspond à ta recherche.'
                  : 'Crée ton premier apprenti avec le bouton « Nouveau » en haut.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ApprentiRow
            apprenti={item}
            onPress={() =>
              router.push({
                pathname: '/(livreur)/profil/apprentis/[id]' as never,
                params: { id: item.id },
              } as never)
            }
            onToggle={() => onToggle(item)}
          />
        )}
      />
    </View>
  );
}

function ApprentiRow({
  apprenti,
  onPress,
  onToggle,
}: {
  apprenti: LivreurResponse;
  onPress: () => void;
  onToggle: () => void;
}) {
  const initials = `${apprenti.prenom[0] ?? ''}${apprenti.nom[0] ?? ''}`.toUpperCase();
  const actif = apprenti.actif !== false;

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2 flex-row items-center gap-3 active:opacity-80"
    >
      {/* Avatar */}
      <View
        className={`w-11 h-11 rounded-full items-center justify-center ${
          actif
            ? 'bg-emerald-100 dark:bg-emerald-500/15'
            : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        <Text
          className={`font-extrabold text-sm ${
            actif
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {initials || '?'}
        </Text>
      </View>

      {/* Infos */}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-extrabold text-slate-900 dark:text-white">
            {apprenti.prenom} {apprenti.nom}
          </Text>
          {!actif ? (
            <View className="bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded">
              <Text className="text-[9px] font-bold text-red-600 dark:text-red-400">
                DÉSACTIVÉ
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {apprenti.username}
          {apprenti.contact ? ` · ${apprenti.contact}` : ''}
        </Text>
      </View>

      {/* Toggle */}
      <Pressable
        onPress={onToggle}
        hitSlop={6}
        className={`p-2 rounded-md active:opacity-60 ${
          actif
            ? 'bg-red-50 dark:bg-red-500/10'
            : 'bg-emerald-50 dark:bg-emerald-500/10'
        }`}
      >
        <Power color={actif ? '#dc2626' : '#059669'} size={14} />
      </Pressable>

      <ChevronRight color="#94a3b8" size={16} />
    </Pressable>
  );
}
