import { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Building2, Users, ArrowRight, ChevronLeft, ChevronRight, History } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { useReversementsSyntheseLivreur } from '../../../../features/reversements/hooks';
import {
  moisCourant,
  moisParam,
  moisPrecedent,
  moisSuivant,
  montantSuggere,
  type Periode,
} from '../../../../features/reversements/regles';
import { num } from '../../../../features/encaissements/regles';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatFCFA, formatMontant } from '../../../../lib/format';

/**
 * Synthèse Reversements (Item A) — affiche pour le mois sélectionné :
 *   - « Mes fournisseurs me doivent » (marge cumulée − dette courante)
 *   - « Je dois à mes clients » : remise acquise / reversée / reste à
 *     reverser / en attente d'encaissement, compte arrêté à la fin du mois
 *     (valeurs serveur). Navigation de mois bornée au mois courant.
 *
 * Source : `GET /livreur/me/reversements-synthese?mois=YYYY-MM`.
 *
 * Tap sur une ligne → page de saisie d'un nouveau reversement avec le
 * bénéficiaire pré-sélectionné.
 */
export default function ReversementsSynthese() {
  const [periode, setPeriode] = useState<Periode>(() => moisCourant());
  const { annee, mois } = periode;
  // Navigation bornée au mois courant (le back refuse un mois à venir).
  const suivant = moisSuivant(periode);

  const q = useReversementsSyntheseLivreur(moisParam(periode));

  const moisLabel = useMemo(() => {
    const date = new Date(annee, mois - 1, 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [annee, mois]);

  const onPrevMonth = () => setPeriode(moisPrecedent(periode));
  const onNextMonth = () => {
    if (suivant) setPeriode(suivant);
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Reversements"
        subtitle={moisLabel}
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/cash/reversements/historique' as never)}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <History color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Historique</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        {/* Sélecteur mois */}
        <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
          <Pressable
            onPress={onPrevMonth}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 active:opacity-70"
          >
            <ChevronLeft color="#64748b" size={18} />
          </Pressable>
          <Text className="font-extrabold text-slate-900 dark:text-white capitalize">
            {moisLabel}
          </Text>
          <Pressable
            onPress={onNextMonth}
            disabled={!suivant}
            className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 ${
              suivant ? 'active:opacity-70' : 'opacity-40'
            }`}
          >
            <ChevronRight color={suivant ? '#64748b' : '#cbd5e1'} size={18} />
          </Pressable>
        </View>

        <View className="px-4">
          {/* Raccourci visible vers l'historique des reversements faits */}
          <Pressable
            onPress={() => router.push('/(livreur)/cash/reversements/historique' as never)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mt-2 mb-3 flex-row items-center gap-3 active:opacity-70"
          >
            <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
              <History color="#059669" size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-slate-900 dark:text-white">
                Mes reversements
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                Historique de tous les reversements que tu as faits
              </Text>
            </View>
            <ArrowRight color="#94a3b8" size={16} />
          </Pressable>

          {q.isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : q.isError ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-4 mt-3">
              <Text className="text-[12px] text-red-700 dark:text-red-400">
                {extractApiErrorMessage(q.error, 'Synthèse indisponible.')}
              </Text>
            </View>
          ) : (
            <>
              {/* Mes fournisseurs me doivent */}
              <View className="flex-row items-center gap-2 mt-3 mb-2">
                <Building2 color="#3b82f6" size={14} />
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                  Mes fournisseurs me doivent
                </Text>
              </View>
              {(q.data?.mesFournisseursMeDoivent ?? []).length === 0 ? (
                <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 items-center mb-4">
                  <Text className="text-[12px] text-slate-400">
                    Aucune marge à recevoir ce mois-ci
                  </Text>
                </View>
              ) : (
                <View className="gap-2 mb-4">
                  {(q.data?.mesFournisseursMeDoivent ?? []).map((f) => (
                    <View
                      key={f.fournisseurId}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3"
                    >
                      <Text className="font-extrabold text-slate-900 dark:text-white">
                        {f.libelle}
                      </Text>
                      <View className="flex-row justify-between mt-2">
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          Marge cumulée
                        </Text>
                        <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {formatFCFA(f.margeCumuleeMois)} F
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          Dette courante
                        </Text>
                        <Text className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          − {formatFCFA(f.detteCourante)} F
                        </Text>
                      </View>
                      <View className="border-t border-slate-100 dark:border-slate-800 mt-2 pt-2 flex-row justify-between">
                        <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                          Net dû
                        </Text>
                        <Text
                          className={`font-extrabold ${
                            f.montantNetDu > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatFCFA(f.montantNetDu)} FCFA
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Je dois à mes clients */}
              <View className="flex-row items-center gap-2 mt-2 mb-2">
                <Users color="#8b5cf6" size={14} />
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                  Je dois à mes clients
                </Text>
              </View>
              <Text className="text-[10px] text-slate-400 mb-2">
                Remise arrêtée à la fin du mois. Seule la remise des livraisons entièrement payées est reversable.
              </Text>
              {(q.data?.jeDoisAMesClients ?? []).length === 0 ? (
                <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 items-center">
                  <Text className="text-[12px] text-slate-400">
                    Aucun reversement à faire ce mois-ci
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {(q.data?.jeDoisAMesClients ?? []).map((c) => {
                    const reste = num(c.resteAReverser ?? c.margeDue);
                    const reversable = reste > 0;
                    return (
                      <Pressable
                        key={c.clientId}
                        disabled={!reversable}
                        onPress={() =>
                          router.push({
                            pathname: '/(livreur)/cash/reversements/nouveau' as never,
                            params: {
                              type: 'CLIENT',
                              beneficiaireId: c.clientId,
                              label: `${c.prenom} ${c.nom ?? ''}`.trim(),
                              montantSuggere: montantSuggere(reste),
                              mois: String(mois),
                              annee: String(annee),
                            },
                          } as never)
                        }
                        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 ${
                          reversable ? 'active:opacity-70' : ''
                        }`}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="flex-1 font-extrabold text-slate-900 dark:text-white">
                            {c.prenom} {c.nom}
                          </Text>
                          <View className="bg-violet-100 dark:bg-violet-500/15 px-2.5 py-1 rounded-full">
                            <Text className="text-[12px] font-extrabold text-violet-700 dark:text-violet-400">
                              {reversable ? `${formatMontant(reste)} F à reverser` : 'Rien à reverser'}
                            </Text>
                          </View>
                          {reversable ? <ArrowRight color="#94a3b8" size={14} /> : null}
                        </View>
                        <LigneMontant libelle="Remise acquise" valeur={c.remiseAcquise} />
                        <LigneMontant libelle="Remise reversée" valeur={c.remiseReversee} />
                        <LigneMontant libelle="Reste à reverser" valeur={reste} gras />
                        <LigneMontant
                          libelle="Remise en attente d'encaissement"
                          valeur={c.remiseEnAttente}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Ligne libellé / montant serveur d'une carte client. */
function LigneMontant({
  libelle,
  valeur,
  gras = false,
}: {
  libelle: string;
  valeur: number | null | undefined;
  gras?: boolean;
}) {
  return (
    <View className="flex-row justify-between mt-1">
      <Text className="text-[11px] text-slate-500 dark:text-slate-400">{libelle}</Text>
      <Text
        className={`text-[11px] ${
          gras ? 'font-extrabold text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-300'
        }`}
      >
        {formatMontant(num(valeur))} F
      </Text>
    </View>
  );
}
