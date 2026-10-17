import { useRef } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { HandCoins, Pencil, Tags } from 'lucide-react-native';
import { PageHeader } from '../../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../../components/shared/FormScreen';
import { EntreeRubrique } from '../../../../../components/fournisseur/EntreeRubrique';
import {
  couleurDu,
  libelleModeVersement,
  useAnnulerSortieClient,
  useSituationClient,
} from '../../../../../features/fournisseur/clients';
import { creerVerrou, lancerUneFois } from '../../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../../stores/networkStore';
import { dialog } from '../../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../../lib/api-error';
import { formatDateShort, formatFCFA, formatMontant } from '../../../../../lib/format';
import { naviguer } from '../../../../../lib/navigation-app';
import type { SortieClientResponse } from '../../../../../types/api';

const SECTION = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';
const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg';

/**
 * Argent → Mes clients → fiche : le dû (sorties au prix figé moins
 * versements), les sorties (le fournisseur peut annuler celles de n'importe
 * quelle date, de façon irréversible), les versements, et les raccourcis Prix,
 * Versement et Modifier.
 */
export default function FicheClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useSituationClient(id);
  const annuler = useAnnulerSortieClient();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const s = q.data;

  const onAnnuler = (sortie: SortieClientResponse) => {
    const jour = formatDateShort(sortie.date);
    dialog.confirm({
      title: 'Annuler cette sortie ?',
      message: `La sortie du ${jour} (${formatFCFA(sortie.montant)} F) sera annulée et retirée du dû de ${s?.client.nom ?? 'ce client'}. Cette action est irréversible.`,
      confirmLabel: 'Annuler la sortie',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          annuler.mutate(sortie.id, {
            onSettled: fin,
            onSuccess: () => dialog.success('Sortie annulée'),
            onError: (e) => dialog.error('Annulation impossible', extractApiErrorMessage(e, 'La sortie n’a pas pu être annulée.')),
          }),
        ),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={s?.client.nom ?? 'Client'} subtitle={s?.client.contact ?? undefined} />
      <FormScreen
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />}
      >
        <View className="px-4">
          {q.isLoading ? (
            <Text className="text-slate-400 text-sm pt-2">Chargement…</Text>
          ) : q.isError || !s ? (
            <View className="pt-2 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">{extractApiErrorMessage(q.error, 'Situation indisponible')}</Text>
              <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View className={`${CARTE} p-4 mt-2`}>
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">Dû</Text>
                <Text
                  accessibilityLabel="Dû du client"
                  className={`text-2xl font-extrabold ${couleurDu(s.du) === 'rouge' ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}
                >
                  {`${formatFCFA(s.du)} F`}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {`Sorties ${formatFCFA(s.totalSorties)} F · versé ${formatFCFA(s.totalVerse)} F`}
                </Text>
              </View>

              <View className="gap-2 mt-3">
                <EntreeRubrique
                  Icone={Tags}
                  couleur="#7c3aed"
                  titre="Prix du client"
                  detail="Son prix pour chaque produit"
                  onPress={() => naviguer(`/fournisseur/argent/clients/${id}/prix`)}
                />
                <EntreeRubrique
                  Icone={HandCoins}
                  couleur="#047857"
                  titre="Enregistrer un versement du client"
                  detail="Un paiement qui réduit son dû"
                  onPress={() => naviguer(`/fournisseur/argent/clients/${id}/versement`)}
                />
                <EntreeRubrique
                  Icone={Pencil}
                  couleur="#2563eb"
                  titre="Modifier le client"
                  detail="Nom, téléphone, actif ou inactif"
                  onPress={() => naviguer(`/fournisseur/argent/clients/${id}/modifier`)}
                />
              </View>

              <Text className={SECTION}>Sorties</Text>
              {s.sorties.length === 0 ? (
                <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucune sortie.</Text>
              ) : (
                <View className="gap-2">
                  {s.sorties.map((sortie) => (
                    <View key={sortie.id} className={`${CARTE} p-3`}>
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{formatDateShort(sortie.date)}</Text>
                        {sortie.annulee ? (
                          <View className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Annulée</Text>
                          </View>
                        ) : (
                          <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{`${formatFCFA(sortie.montant)} F`}</Text>
                        )}
                      </View>
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                        {`Enregistrée par ${sortie.auteur.prenom} ${sortie.auteur.nom}`.trim()}
                      </Text>
                      {sortie.lignes.map((l) => (
                        <Text
                          key={l.produitFournisseurId}
                          className={`text-[12px] mt-0.5 ${sortie.annulee ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}
                        >
                          {`${l.quantite} × ${l.designation} · ${formatMontant(l.prixUnitaire)} F`}
                        </Text>
                      ))}
                      {!sortie.annulee ? (
                        <Pressable
                          onPress={() => onAnnuler(sortie)}
                          disabled={!isOnline}
                          accessibilityRole="button"
                          accessibilityLabel={`Annuler la sortie du ${formatDateShort(sortie.date)}`}
                          className="self-start mt-2 active:opacity-70"
                        >
                          <Text className={`text-[12px] font-bold ${isOnline ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                            Annuler la sortie
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}

              <Text className={SECTION}>Versements</Text>
              {s.versements.length === 0 ? (
                <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucun versement.</Text>
              ) : (
                <View className="gap-2">
                  {s.versements.map((v) => (
                    <View key={v.id} className={`${CARTE} p-3 flex-row items-center justify-between gap-2`}>
                      <View className="flex-1">
                        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{formatDateShort(v.date)}</Text>
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">{libelleModeVersement(v.mode)}</Text>
                        {v.commentaire ? <Text className="text-[11px] text-slate-500 dark:text-slate-400">{v.commentaire}</Text> : null}
                      </View>
                      <Text className="font-extrabold text-emerald-700 dark:text-emerald-400 text-[13px]">{`${formatFCFA(v.montant)} F`}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-4">
                Dû = total des sorties (prix figé à la sortie, sorties annulées exclues) moins les versements.
              </Text>
            </>
          )}
        </View>
      </FormScreen>
    </View>
  );
}
