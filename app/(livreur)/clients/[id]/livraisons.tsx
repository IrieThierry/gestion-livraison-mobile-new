import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ListFilter } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { LivraisonCard } from '../../../../components/livreur/LivraisonCard';
import { useClientsByLivreur } from '../../../../features/clients/hooks';
import { useLivraisonsByLivreur } from '../../../../features/livraisons/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { formatFCFA } from '../../../../lib/format';

type Periode = '7j' | '30j' | '90j' | 'all';
type LivraisonStatut = 'all' | 'LIVREE' | 'ENCAISSEE';

const PERIODES: Array<{ key: Periode; label: string; days: number | null }> = [
  { key: '7j', label: '7 jours', days: 7 },
  { key: '30j', label: '30 jours', days: 30 },
  { key: '90j', label: '90 jours', days: 90 },
  { key: 'all', label: 'Tout', days: null },
];

/**
 * Sous-page « Toutes les livraisons d'un client » — accessible depuis
 * la fiche client. Liste filtrable par période + statut. Côté UX, on a
 * sorti cette liste de la fiche principale qui devenait trop chargée.
 */
export default function LivraisonsClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qC = useClientsByLivreur(livreurId);
  const qL = useLivraisonsByLivreur(livreurId);

  const [periode, setPeriode] = useState<Periode>('30j');
  const [statut, setStatut] = useState<LivraisonStatut>('all');

  const client = useMemo(
    () => (qC.data ?? []).find((c) => c.id === id),
    [qC.data, id],
  );

  const livraisons = useMemo(
    () =>
      (qL.data ?? [])
        .filter((l) => l.client.id === id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [qL.data, id],
  );

  const filtrees = useMemo(() => {
    const now = Date.now();
    const days = PERIODES.find((p) => p.key === periode)?.days ?? null;
    return livraisons.filter((l) => {
      if (days !== null && now - new Date(l.date).getTime() > days * 86_400_000) {
        return false;
      }
      if (statut === 'all') return true;
      if (statut === 'ENCAISSEE') return l.statut === 'ENCAISSEE';
      if (statut === 'LIVREE') return l.statut !== 'ENCAISSEE';
      return true;
    });
  }, [livraisons, periode, statut]);

  const total = filtrees.reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);

  const fullName = client ? `${client.prenom} ${client.nom}`.trim() : 'Client';

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Livraisons" subtitle={fullName} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={qL.isFetching && !qL.isLoading}
            onRefresh={() => qL.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Filtres période */}
          <View className="flex-row items-center gap-1.5 mb-2">
            <ListFilter color="#64748b" size={12} />
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Période
            </Text>
          </View>
          <View className="flex-row gap-2 mb-3">
            {PERIODES.map((p) => (
              <FilterChip
                key={p.key}
                active={periode === p.key}
                label={p.label}
                onPress={() => setPeriode(p.key)}
              />
            ))}
          </View>

          {/* Filtres statut */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Statut
          </Text>
          <View className="flex-row gap-2 mb-3">
            <FilterChip
              active={statut === 'all'}
              label="Toutes"
              onPress={() => setStatut('all')}
            />
            <FilterChip
              active={statut === 'LIVREE'}
              label="Non encaissée"
              onPress={() => setStatut('LIVREE')}
            />
            <FilterChip
              active={statut === 'ENCAISSEE'}
              label="Encaissée"
              onPress={() => setStatut('ENCAISSEE')}
            />
          </View>

          {/* Récap */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mb-3 flex-row justify-between items-center">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400">
              {filtrees.length} livraison{filtrees.length > 1 ? 's' : ''}
            </Text>
            <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatFCFA(total)} F
            </Text>
          </View>

          {filtrees.length === 0 ? (
            <EmptyState
              title="Aucune livraison"
              message="Aucune livraison ne correspond aux filtres."
            />
          ) : (
            <View className="gap-2">
              {filtrees.map((l) => (
                <LivraisonCard key={l.id} livraison={l} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-1.5 rounded-md border ${
        active
          ? 'bg-emerald-500 border-emerald-500'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <Text
        className={`text-[12px] font-bold ${
          active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
