import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { FiltrePeriode } from '../../../components/shared/FiltrePeriode';
import { useMesAvoirs, useMesFactures } from '../../../features/organisation/hooks';
import { usePartageDocuments } from '../../../features/organisation/usePartageDocuments';
import { useNetworkStore } from '../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateShort, formatMontant } from '../../../lib/format';
import {
  bornesPeriode,
  derniersJours,
  moisEnCours,
  type OptionPeriode,
  type ValeurPeriode,
} from '../../../lib/periode';
import type { AvoirResponse, FactureResponse } from '../../../types/api';

type Raccourci = 'mois' | '7j' | '30j';
const PERIODES: ReadonlyArray<OptionPeriode<Raccourci>> = [
  { cle: 'mois', label: 'Ce mois', bornes: moisEnCours },
  { cle: '7j', label: '7 j', bornes: (n) => derniersJours(7, n) },
  { cle: '30j', label: '30 j', bornes: (n) => derniersJours(30, n) },
];

type Onglet = 'factures' | 'avoirs';

const nomClient = (c: { prenom: string | null; nom: string | null }) =>
  [c.prenom, c.nom].map((s) => s?.trim()).filter(Boolean).join(' ') || 'Client';

/**
 * « Mes factures » du commercial (O17) : ses factures et ses avoirs sur une
 * période (cloisonnés par le back), chacun partageable en PDF.
 */
export default function MesFactures() {
  const [onglet, setOnglet] = useState<Onglet>('factures');
  const [periode, setPeriode] = useState<ValeurPeriode<Raccourci>>({ cle: 'mois' });
  const bornes = bornesPeriode(periode, PERIODES);
  const filtres = useMemo(() => ({ debut: bornes.debut, fin: bornes.fin }), [bornes.debut, bornes.fin]);
  const qFactures = useMesFactures(filtres);
  const qAvoirs = useMesAvoirs(filtres);
  const partage = usePartageDocuments();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const q = onglet === 'factures' ? qFactures : qAvoirs;

  const factures = qFactures.data ?? [];
  const avoirs = qAvoirs.data ?? [];
  const total = onglet === 'factures' ? factures.length : avoirs.length;

  const vide = q.isLoading ? (
    <Text className="text-slate-400 text-sm">Chargement…</Text>
  ) : q.isError ? (
    <EmptyState
      title={onglet === 'factures' ? 'Factures indisponibles' : 'Avoirs indisponibles'}
      message={extractApiErrorMessage(q.error, 'La liste n’a pas pu être lue.')}
    />
  ) : (
    <EmptyState
      title={onglet === 'factures' ? 'Aucune facture' : 'Aucun avoir'}
      message={
        onglet === 'factures'
          ? 'Chaque vente enregistrée émet sa facture.'
          : 'Un retour produit sur une vente facturée émet un avoir.'
      }
    />
  );

  const boutonPartage = (id: string, onPress: () => void, libelle: string) => (
    <Pressable
      onPress={onPress}
      disabled={!isOnline || partage.enCours === id}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-md border ${
        isOnline ? 'border-emerald-500 active:opacity-70' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {partage.enCours === id ? (
        <ActivityIndicator color="#10b981" size="small" />
      ) : (
        <Share2 color={isOnline ? '#059669' : '#94a3b8'} size={14} />
      )}
      <Text className={`text-[12px] font-bold ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
        Partager
      </Text>
    </Pressable>
  );

  const carteFacture = (f: FactureResponse) => (
    <View
      accessibilityLabel={`Facture ${f.numero}`}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3"
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white">{f.numero}</Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            {formatDateShort(f.date)} · {nomClient(f.client)}
          </Text>
        </View>
        {boutonPartage(f.id, () => partage.facture(f), `Partager la facture ${f.numero}`)}
      </View>
      <View className="flex-row gap-4 mt-2">
        <Text className="text-[12px] text-slate-500 dark:text-slate-400">
          Total TTC <Text className="font-bold text-slate-800 dark:text-slate-200">{formatMontant(Number(f.totalTtc))} F</Text>
        </Text>
        <Text className="text-[12px] text-slate-500 dark:text-slate-400">
          Reste dû{' '}
          <Text
            className={`font-bold ${
              Number(f.resteDu) > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatMontant(Number(f.resteDu))} F
          </Text>
        </Text>
      </View>
      {f.avoirs.length > 0 ? (
        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Avoirs : {f.avoirs.map((a) => a.numero).join(', ')}
        </Text>
      ) : null}
    </View>
  );

  const carteAvoir = (a: AvoirResponse) => (
    <View
      accessibilityLabel={`Avoir ${a.numero}`}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex-row items-center justify-between gap-2"
    >
      <View className="flex-1">
        <Text className="font-extrabold text-slate-900 dark:text-white">{a.numero}</Text>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
          {formatDateShort(a.date)} · {nomClient(a.client)} · facture {a.factureNumero}
        </Text>
        <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
          Total TTC <Text className="font-bold text-slate-800 dark:text-slate-200">{formatMontant(Number(a.totalTtc))} F</Text>
        </Text>
      </View>
      {boutonPartage(a.id, () => partage.avoir(a.id), `Partager l’avoir ${a.numero}`)}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes factures"
        subtitle={`${total} ${onglet === 'factures' ? `facture${total > 1 ? 's' : ''}` : `avoir${total > 1 ? 's' : ''}`}`}
      />
      <View className="px-4 pt-2 gap-3">
        <View className="flex-row gap-2">
          {(
            [
              { id: 'factures', label: 'Factures' },
              { id: 'avoirs', label: 'Avoirs' },
            ] as const
          ).map((o) => {
            const actif = onglet === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => setOnglet(o.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
                className={`px-3 py-1.5 rounded-full border ${
                  actif ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Text className={`text-xs font-bold ${actif ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <FiltrePeriode options={PERIODES} valeur={periode} defaut="mois" onChange={setPeriode} titre={null} />
      </View>
      {onglet === 'factures' ? (
        <FlatList
          data={factures}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12, gap: 8 }}
          refreshControl={
            <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#10b981" />
          }
          ListEmptyComponent={vide}
          renderItem={({ item }) => carteFacture(item)}
        />
      ) : (
        <FlatList
          data={avoirs}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12, gap: 8 }}
          refreshControl={
            <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#10b981" />
          }
          ListEmptyComponent={vide}
          renderItem={({ item }) => carteAvoir(item)}
        />
      )}
    </View>
  );
}
