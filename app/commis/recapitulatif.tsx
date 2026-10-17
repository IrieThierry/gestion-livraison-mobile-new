import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { DatePickerField } from '../../components/shared/DatePickerField';
import { ProduitVignette } from '../../components/shared/ProduitVignette';
import { CARTE_COMMIS, CarteRemise, SECTION_COMMIS } from '../../components/commis/ElementsCommis';
import { useRecapitulatifCommis } from '../../features/commis/hooks';
import { totauxRecapitulatif } from '../../features/fournisseur/recapitulatif';
import { extractApiErrorMessage } from '../../lib/api-error';
import { jourIso } from '../../lib/periode';
import type { RemiseCommisResponse } from '../../types/api';

/**
 * Récap (clôture du commis) : pour un jour (aujourd'hui par défaut, ou un jour
 * passé), par produit, les quantités remises à chaque livreur (remises
 * confirmées) et sorties à chaque client, avec les totaux. Les remises en
 * attente ou refusées sont listées à part, hors des totaux. Une remise compte
 * le jour où le commis l'a enregistrée. Ni validation ni verrouillage.
 */
export default function RecapitulatifCommis() {
  const [jour, setJour] = useState<string>(() => jourIso(new Date()));
  const q = useRecapitulatifCommis(jour);
  const produits = q.data?.produits ?? [];
  const totaux = totauxRecapitulatif(produits);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Récapitulatif" subtitle="Ce que tu as remis et sorti dans la journée" showBack={false} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />}
      >
        <DatePickerField label="Jour" value={jour} onChange={(v) => setJour(v ?? jourIso(new Date()))} maximumDate={new Date()} />

        {q.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#047857" />
          </View>
        ) : q.isError ? (
          <View className="pt-4 gap-2">
            <Text className="text-red-600 dark:text-red-400 text-sm">{extractApiErrorMessage(q.error, 'Récapitulatif indisponible')}</Text>
            <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
              <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className={SECTION_COMMIS}>Par produit</Text>
            {produits.length === 0 ? (
              <EmptyState title="Aucune remise confirmée ni sortie." message="Rien n’a été remis ou sorti ce jour-là." />
            ) : (
              <View className="gap-2">
                <View className={`${CARTE_COMMIS} p-3 flex-row justify-between`}>
                  <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-200">Total</Text>
                  <Text accessibilityLabel="Total général" className="text-[12px] font-extrabold text-slate-900 dark:text-white">
                    {`${totaux.remis} remis · ${totaux.sortis} sortis`}
                  </Text>
                </View>
                {produits.map((p) => (
                  <View key={p.produitFournisseurId} className={`${CARTE_COMMIS} p-3`}>
                    <View className="flex-row items-center gap-3">
                      <ProduitVignette designation={p.designation} photoUrl={p.photoUrl} size={36} />
                      <Text className="flex-1 font-extrabold text-slate-900 dark:text-white text-[13px]">{p.designation ?? '—'}</Text>
                    </View>
                    <View className="flex-row gap-6 mt-2">
                      <View>
                        <Text className="text-[10px] text-slate-500 dark:text-slate-400">Remis aux livreurs</Text>
                        <Text
                          accessibilityLabel={`Total remis aux livreurs : ${p.designation ?? ''}`}
                          className="font-extrabold text-slate-900 dark:text-white text-base"
                        >
                          {p.totalConfirme}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-[10px] text-slate-500 dark:text-slate-400">Sortis aux clients</Text>
                        <Text
                          accessibilityLabel={`Total sorti aux clients : ${p.designation ?? ''}`}
                          className="font-extrabold text-slate-900 dark:text-white text-base"
                        >
                          {p.totalClients}
                        </Text>
                      </View>
                    </View>
                    {p.parLivreur.map((l) => (
                      <Text key={`l-${l.livreurId}`} className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {`${l.nom ?? 'Livreur'} : ${l.quantite}`}
                      </Text>
                    ))}
                    {p.parClient.map((c) => (
                      <Text key={`c-${c.clientId}`} className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {`${c.nom ?? 'Client'} : ${c.quantite}`}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )}

            <ListeRemises titre="En attente" aide="Pas encore confirmées par le livreur : hors des totaux." remises={q.data?.enAttente ?? []} />
            <ListeRemises titre="Refusées" aide="Refusées par le livreur : hors des totaux." remises={q.data?.refusees ?? []} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ListeRemises({ titre, aide, remises }: { titre: string; aide: string; remises: RemiseCommisResponse[] }) {
  return (
    <View className="mt-5">
      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{`${titre} (${remises.length})`}</Text>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{aide}</Text>
      {remises.length === 0 ? (
        <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucune remise.</Text>
      ) : (
        <View className="gap-2">
          {remises.map((r) => (
            <CarteRemise key={r.id} remise={r} avecLivreur />
          ))}
        </View>
      )}
    </View>
  );
}
