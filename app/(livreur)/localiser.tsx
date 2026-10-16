import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { PageHeader } from '../../components/shared/PageHeader';
import { Avatar } from '../../components/shared/Avatar';
import { EmptyState } from '../../components/shared/EmptyState';
import { BoutonItineraire } from '../../components/shared/BoutonItineraire';
import { buildHtmlPositions, positionsDuJour } from '../../features/localisation/carte';
import { enAttente, libelleRepere, lignesEtat } from '../../features/localisation/etat';
import { useDemanderLocalisation, usePersonnesLocalisables } from '../../features/localisation/hooks';
import { extractApiErrorMessage } from '../../lib/api-error';
import { lirePosition } from '../../lib/position';
import type { PersonneLocalisable } from '../../types/api';

/**
 * Localiser : les personnes que je peux localiser (commerciaux du responsable, collègues du
 * commercial, apprentis du principal) avec l'état du jour, Itinéraire et Redemander, et une
 * mini-carte des positions partagées aujourd'hui (appui sur un marqueur : nom, heure, Itinéraire).
 */
export default function Localiser() {
  const q = usePersonnesLocalisables();
  const demander = useDemanderLocalisation();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string | null>(null);
  const personnes = q.data ?? [];
  const maintenant = new Date();

  const pins = useMemo(() => positionsDuJour(personnes), [personnes]);
  // La carte ne se recharge que si les marqueurs changent (pas à chaque relecture).
  const cleCarte = JSON.stringify(pins);
  const html = useMemo(() => buildHtmlPositions(personnes), [cleCarte]);
  const choisie = pins.find((p) => p.id === selection) ?? null;
  const personneChoisie = personnes.find((p) => p.id === choisie?.id);

  const onDemander = (p: PersonneLocalisable) => {
    setErreurs((e) => ({ ...e, [p.id]: '' }));
    demander.mutate(p.id, {
      onError: (err) =>
        setErreurs((e) => ({ ...e, [p.id]: extractApiErrorMessage(err, 'La demande n’a pas pu être envoyée.') })),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Localiser" subtitle="Positions partagées aujourd’hui" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />
        }
      >
        {q.isLoading ? (
          <ActivityIndicator color="#047857" className="mt-8" />
        ) : q.isError ? (
          <EmptyState title="Chargement impossible" message={extractApiErrorMessage(q.error, 'Réessaie plus tard.')} />
        ) : personnes.length === 0 ? (
          <EmptyState title="Personne à localiser" />
        ) : (
          <View className="px-4">
            {pins.length > 0 ? (
              <View className="h-56 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 mb-3">
                <WebView
                  originWhitelist={['*']}
                  source={{ html }}
                  style={{ flex: 1, backgroundColor: '#0f172a' }}
                  scrollEnabled={false}
                  onMessage={(event) => {
                    try {
                      const msg = JSON.parse(event.nativeEvent.data);
                      if (msg.type === 'POSITION_TAP' && typeof msg.id === 'string') setSelection(msg.id);
                    } catch {
                      /* message illisible : ignoré */
                    }
                  }}
                />
              </View>
            ) : null}
            {choisie && personneChoisie ? (
              <View className="flex-row items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-3">
                <View className="flex-1">
                  <Text className="font-extrabold text-slate-900 dark:text-white">{choisie.nom}</Text>
                  <Text className="text-[12px] text-slate-500 dark:text-slate-400">Partagée à {choisie.heure}</Text>
                </View>
                <BoutonItineraire position={personneChoisie.etat?.position} />
                <Pressable
                  onPress={() => setSelection(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  className="ml-2"
                >
                  <X color="#94a3b8" size={18} />
                </Pressable>
              </View>
            ) : null}
            {personnes.map((p) => {
              const attente = enAttente(p.etat, maintenant);
              const repere = p.etat?.position ? libelleRepere(p.etat.repere) : '';
              const desactive = attente || demander.isPending;
              const libelle = p.etat ? 'Redemander' : 'Demander sa position';
              return (
                <View
                  key={p.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2"
                >
                  <View className="flex-row items-center gap-3">
                    <Avatar prenom={p.prenom} nom={p.nom} photoUrl={p.photoUrl} size={40} />
                    <View className="flex-1">
                      <Text className="font-extrabold text-slate-900 dark:text-white">
                        {p.prenom} {p.nom}
                      </Text>
                      {lignesEtat(p.etat, maintenant).map((ligne) => (
                        <Text key={ligne} className="text-[12px] text-slate-500 dark:text-slate-400">
                          {ligne}
                        </Text>
                      ))}
                      {repere ? <Text className="text-[11px] text-slate-500 dark:text-slate-400">{repere}</Text> : null}
                    </View>
                  </View>
                  {erreurs[p.id] ? (
                    <Text className="text-[12px] text-red-600 dark:text-red-400 mt-2">{erreurs[p.id]}</Text>
                  ) : null}
                  <View className="flex-row justify-end gap-2 mt-2">
                    {lirePosition(p.etat?.position) ? <BoutonItineraire position={p.etat?.position} /> : null}
                    <Pressable
                      onPress={() => onDemander(p)}
                      disabled={desactive}
                      accessibilityRole="button"
                      accessibilityLabel={libelle}
                      accessibilityState={{ disabled: desactive }}
                      className={`rounded-md px-3 py-2 bg-emerald-700 active:opacity-80 ${desactive ? 'opacity-40' : ''}`}
                    >
                      <Text className="font-bold text-[12px] text-white">{libelle}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
