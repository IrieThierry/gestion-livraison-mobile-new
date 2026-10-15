import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Search, X, ChevronLeft, Plus } from 'lucide-react-native';
import { useLivraisonsLivreurPeriode } from '../../../features/livraisons/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { LivraisonCard } from '../../../components/livreur/LivraisonCard';
import { EmptyState } from '../../../components/shared/EmptyState';
import { formatFCFA, formatMontant } from '../../../lib/format';
import { isEncaissee } from '../../../lib/livraison-status';
import { num, totalMontantDu, totalRemiseNette } from '../../../features/encaissements/regles';
import type { LivraisonResponse } from '../../../types/api';
import { naviguer, retourParent } from '../../../lib/navigation-app';
import { FiltrePeriode } from '../../../components/shared/FiltrePeriode';
import {
  aujourdhui,
  bornesPeriode,
  dansBornes,
  derniersJours,
  estPeriodePerso,
  type OptionPeriode,
  type ValeurPeriode,
} from '../../../lib/periode';

type Raccourci = 'today' | '7j' | '30j';

/**
 * Période de la liste (Aujourd'hui par défaut) : envoyée à la route
 * (`debut` / `fin`) ; elle filtre la liste, les compteurs et la recherche.
 */
const PERIODES: ReadonlyArray<OptionPeriode<Raccourci>> = [
  { cle: 'today', label: "Aujourd'hui", bornes: aujourdhui },
  { cle: '7j', label: '7 j', bornes: (n) => derniersJours(7, n) },
  { cle: '30j', label: '30 j', bornes: (n) => derniersJours(30, n) },
];

export default function LivraisonsList() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const [period, setPeriod] = useState<ValeurPeriode<Raccourci>>({ cle: 'today' });
  // Bornes recalculées à chaque rendu (jour courant) ; la clé de requête ne change qu'avec elles.
  const bornes = bornesPeriode(period, PERIODES);
  const q = useLivraisonsLivreurPeriode(livreurId, bornes);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { debut, fin } = bornes;
  const filtered = useMemo<LivraisonResponse[]>(() => {
    // Le back filtre déjà ; le filtre local garde la liste cohérente avec la pastille.
    let list = (q.data ?? []).filter((l) => dansBornes(l.date, { debut, fin }));
    if (search.trim()) {
      const needle = search.toLowerCase();
      list = list.filter(
        (l) =>
          `${l.client.prenom} ${l.client.nom}`.toLowerCase().includes(needle) ||
          (l.client.quartier?.libelle ?? '').toLowerCase().includes(needle),
      );
    }
    // Tri stable : plus récent en premier (date desc)
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [q.data, debut, fin, search]);

  const stats = useMemo(() => {
    // Badge à deux états (E8) : « Encaissée » dès un paiement, même partiel.
    let encaissees = 0;
    let nonEncaissees = 0;
    for (const l of filtered) {
      if (isEncaissee(l)) encaissees += 1;
      else nonEncaissees += 1;
    }
    // Montants serveur uniquement : dû net (avant paiements), reste dû et remise nette.
    const totalDu = totalMontantDu(filtered);
    const resteDu = filtered.reduce((acc, l) => acc + num(l.resteDu), 0);
    const remise = totalRemiseNette(filtered);
    return { encaissees, nonEncaissees, totalDu, resteDu, remise };
  }, [filtered]);

  if (!user) return null;

  const subtitle = `${filtered.length} livraison${filtered.length > 1 ? 's' : ''}${
    !estPeriodePerso(period) && period.cle === 'today' ? " aujourd'hui" : ''
  }`;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-3 pb-2 gap-3">
        <Pressable
          // Liste : retour à l'Accueil (parent logique, lib/navigation).
          onPress={() => retourParent('/livraisons')}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          className="w-10 h-10 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
        >
          <ChevronLeft color="#475569" size={20} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white text-lg">Livraisons</Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</Text>
        </View>
        <Pressable
          onPress={() => naviguer('/(livreur)/livraisons/nouvelle')}
          accessibilityRole="button"
          accessibilityLabel="Nouvelle livraison"
          className="bg-emerald-700 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
        >
          <Plus color="#fff" size={14} />
          <Text className="text-white text-xs font-bold">Nouvelle</Text>
        </Pressable>
        <Pressable
          onPress={() => setSearchOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Fermer la recherche' : 'Rechercher'}
          hitSlop={8}
          className="w-10 h-10 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
        >
          {searchOpen ? <X color="#475569" size={18} /> : <Search color="#475569" size={18} />}
        </Pressable>
      </View>

      {searchOpen ? (
        <View className="px-4 pb-2">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un client ou quartier…"
            placeholderTextColor="#94a3b8"
            autoFocus
            autoCorrect={false}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2.5 text-slate-900 dark:text-white text-base"
          />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#047857"
          />
        }
      >
        <View className="px-4">
          {/* Compteurs : badge à deux états + reste dû (serveur) */}
          <View className="flex-row gap-2 mt-1">
            <StatCount label="Encaissée" value={stats.encaissees} accent="emerald" />
            <StatCount label="Non encaissée" value={stats.nonEncaissees} accent="amber" />
            <View
              accessible
              accessibilityLabel={`Reste dû : ${formatMontant(stats.resteDu)}`}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-red-500 rounded-lg p-2.5"
            >
              <Text className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-extrabold">
                Reste dû
              </Text>
              <Text className="text-base font-extrabold text-slate-900 dark:text-white mt-1 leading-none">
                {formatMontant(stats.resteDu)}
              </Text>
            </View>
          </View>

          {/* Total livré (dû) + Remise (nette) banner */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mt-2 flex-row">
            <View className="flex-1">
              <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                Total livré (dû)
              </Text>
              <Text className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                <Text className="text-xl">{formatFCFA(stats.totalDu)}</Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400"> FCFA</Text>
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                Remise (nette)
              </Text>
              <Text className="font-extrabold text-emerald-800 dark:text-emerald-400 text-xl mt-0.5">
                {formatMontant(stats.remise)}
              </Text>
            </View>
          </View>

          {/* Période : Aujourd'hui / 7 j / 30 j / Période… */}
          <View className="mt-3">
            <FiltrePeriode options={PERIODES} valeur={period} defaut="today" onChange={setPeriod} titre={null} />
          </View>

          {/* Section title */}
          <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 mt-4 mb-2">
            Ma tournée
          </Text>

          {/* List */}
          {q.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Aucune livraison"
              message={
                search
                  ? 'Aucun résultat pour cette recherche.'
                  : 'Ajuste les filtres ou crée une livraison via le bouton ➕.'
              }
            />
          ) : (
            <View className="gap-2">
              {filtered.map((l) => (
                <LivraisonCard key={l.id} livraison={l} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCount({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'emerald' | 'amber' | 'red';
}) {
  const border =
    accent === 'emerald'
      ? 'border-l-emerald-700'
      : accent === 'amber'
        ? 'border-l-amber-500'
        : 'border-l-red-500';
  return (
    <View
      accessible
      accessibilityLabel={`${label} : ${value}`}
      className={`flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${border} rounded-lg p-2.5`}
    >
      <Text className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-extrabold">
        {label}
      </Text>
      <Text className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-none">
        {value}
      </Text>
    </View>
  );
}
