import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { FiltrePeriode } from '../../../components/shared/FiltrePeriode';
import { RemiseArgentCarte, useDecisionRemise } from '../../../components/livreur/RemiseArgentCarte';
import { useApprentis } from '../../../features/apprentis/hooks';
import { useRemisesApprentis } from '../../../features/remises-argent/hooks';
import { LIBELLE_STATUT_REMISE, STATUTS_REMISE, nomLivreur } from '../../../features/remises-argent/regles';
import { num } from '../../../features/encaissements/regles';
import { bornesPeriode, derniersJours, moisEnCours, type OptionPeriode, type ValeurPeriode } from '../../../lib/periode';
import { formatMontant } from '../../../lib/format';
import { useAuthStore } from '../../../stores/authStore';
import { vocabulaire } from '../../../features/organisation/regles';
import type { FiltresRemisesArgent, StatutRemiseArgent } from '../../../types/api';

type Raccourci = 'tout' | 'mois' | '30j';

/** Raccourcis de période (tout par défaut) ; « Période… » : Du / Au. */
const PERIODES: ReadonlyArray<OptionPeriode<Raccourci>> = [
  { cle: 'tout', label: 'Tout', bornes: () => ({}) },
  { cle: 'mois', label: 'Ce mois', bornes: moisEnCours },
  { cle: '30j', label: '30 jours', bornes: (n) => derniersJours(30, n) },
];

/**
 * « Remises des apprentis » (principal) : l'argent déclaré par ses
 * apprentis, filtré par apprenti (prérempli depuis la fiche apprenti avec
 * `?apprentiId=`), statut et période. Une remise déclarée se confirme ou se
 * conteste (motif obligatoire).
 */
export default function RemisesApprentis() {
  const params = useLocalSearchParams<{ apprentiId?: string }>();
  // Organisation (O4) : « Remises des commerciaux », filtre « Commercial ».
  const v = vocabulaire(useAuthStore((s) => s.user));
  const apprentisQ = useApprentis();
  const [apprentiId, setApprentiId] = useState<string | null>(
    typeof params.apprentiId === 'string' && params.apprentiId ? params.apprentiId : null,
  );
  const [statut, setStatut] = useState<StatutRemiseArgent | null>(null);
  const [periode, setPeriode] = useState<ValeurPeriode<Raccourci>>({ cle: 'tout' });

  const filtres = useMemo<FiltresRemisesArgent>(() => {
    const b = bornesPeriode(periode, PERIODES);
    return {
      ...(apprentiId ? { apprentiId } : {}),
      ...(statut ? { statut } : {}),
      ...(b.debut ? { debut: b.debut } : {}),
      ...(b.fin ? { fin: b.fin } : {}),
    };
  }, [apprentiId, statut, periode]);

  const q = useRemisesApprentis(filtres);
  const decision = useDecisionRemise();
  const remises = q.data ?? [];
  const total = useMemo(() => remises.reduce((acc, r) => acc + num(r.montant), 0), [remises]);

  const apprentis = apprentisQ.data ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={`Remises des ${v.apprentis}`}
        subtitle={
          q.data ? `${remises.length} remise${remises.length > 1 ? 's' : ''} · ${formatMontant(total)} FCFA` : undefined
        }
      />

      <FlatList
        data={q.isError ? [] : remises}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#10b981" />
        }
        ListHeaderComponent={
          <View className="gap-3 mb-1">
            <Filtre titre={v.Apprenti}>
              <Puce
                label="Tous"
                aria="Apprenti Tous"
                active={apprentiId === null}
                onPress={() => setApprentiId(null)}
              />
              {apprentis.map((a) => (
                <Puce
                  key={a.id}
                  label={nomLivreur(a)}
                  aria={`Apprenti ${nomLivreur(a)}`}
                  active={apprentiId === a.id}
                  onPress={() => setApprentiId(a.id)}
                />
              ))}
            </Filtre>
            <Filtre titre="Statut">
              <Puce label="Tous" aria="Statut Tous" active={statut === null} onPress={() => setStatut(null)} />
              {STATUTS_REMISE.map((s) => (
                <Puce
                  key={s}
                  label={LIBELLE_STATUT_REMISE[s]}
                  aria={`Statut ${LIBELLE_STATUT_REMISE[s]}`}
                  active={statut === s}
                  onPress={() => setStatut(s)}
                />
              ))}
            </Filtre>
            <FiltrePeriode options={PERIODES} valeur={periode} defaut="tout" onChange={setPeriode} />
          </View>
        }
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator color="#10b981" style={{ marginTop: 32 }} />
          ) : q.isError ? (
            <EmptyState title="Chargement impossible" message="Les remises n’ont pas pu être lues. Tire pour réessayer." />
          ) : (
            <EmptyState title="Aucune remise" message="Aucune remise ne correspond à ces filtres." />
          )
        }
        renderItem={({ item }) => <RemiseArgentCarte remise={item} avecApprenti actions={decision.actions(item)} />}
      />
      {decision.dialogue}
    </View>
  );
}

function Filtre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {titre}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {children}
      </ScrollView>
    </View>
  );
}

function Puce({ label, aria, active, onPress }: { label: string; aria: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={aria}
      accessibilityState={{ selected: active }}
      className={`px-3 py-1.5 rounded-md border ${
        active ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <Text className={`text-[12px] font-bold ${active ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
