import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { FiltrePeriode } from '../../components/shared/FiltrePeriode';
import { ProduitVignette } from '../../components/shared/ProduitVignette';
import { SelectField, type SelectOption } from '../../components/shared/SelectField';
import { useCommisFournisseur, nomCommis } from '../../features/fournisseur/commis';
import { useClientsFournisseur } from '../../features/fournisseur/clients';
import { useLivreursPartenaires } from '../../features/fournisseur/hooks';
import { nomLivreur } from '../../features/fournisseur/gestion';
import {
  filtresRecapitulatif,
  totauxRecapitulatif,
  useRecapitulatifRemises,
} from '../../features/fournisseur/recapitulatif';
import { PERIODES_JOURS, bornesPeriode, jourIso, type RaccourciJours, type ValeurPeriode } from '../../lib/periode';
import { extractApiErrorMessage } from '../../lib/api-error';
import { formatDateShort, formatTime } from '../../lib/format';
import type { RemiseCommisResponse } from '../../types/api';

const CARTE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg';
const SECTION = 'text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2';

const nomPersonne = (p: { prenom?: string | null; nom?: string | null }) => `${p.prenom ?? ''} ${p.nom ?? ''}`.trim();

/**
 * Récapitulatif des remises (lecture seule), depuis l'Accueil et Livreurs :
 * par produit, les quantités remises aux livreurs (remises confirmées) et
 * sorties aux clients, avec les totaux, filtrables par période, commis,
 * livreur et client. Il répond aussi à « produits livrés et quantités avec
 * filtre livreur ». Les remises en attente ou refusées sont listées à part,
 * hors des totaux. Une remise compte le jour où le commis l'a enregistrée.
 */
export default function RecapitulatifRemises() {
  const [periode, setPeriode] = useState<ValeurPeriode<RaccourciJours>>({ cle: 'today' });
  const [commisId, setCommisId] = useState('');
  const [livreurId, setLivreurId] = useState('');
  const [clientId, setClientId] = useState('');

  const commisQ = useCommisFournisseur();
  const partenairesQ = useLivreursPartenaires();
  const clientsQ = useClientsFournisseur();

  const bornes = bornesPeriode(periode, PERIODES_JOURS);
  const filtres = filtresRecapitulatif(
    { debut: bornes.debut ?? jourIso(new Date()), fin: bornes.fin ?? jourIso(new Date()) },
    { commisId, livreurId, clientId },
  );
  const q = useRecapitulatifRemises(filtres);

  const optionsCommis = useMemo<SelectOption[]>(
    () => [
      { id: '', label: 'Tous les commis' },
      ...[...(commisQ.data ?? [])].map((c) => ({ id: c.id, label: nomCommis(c) })).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    ],
    [commisQ.data],
  );
  const optionsLivreurs = useMemo<SelectOption[]>(
    () => [
      { id: '', label: 'Tous les livreurs' },
      ...[...(partenairesQ.data ?? [])]
        .map((p) => ({ id: p.livreur.id, label: nomLivreur(p.livreur) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    ],
    [partenairesQ.data],
  );
  const optionsClients = useMemo<SelectOption[]>(
    () => [
      { id: '', label: 'Tous les clients' },
      ...[...(clientsQ.data ?? [])].map((c) => ({ id: c.id, label: c.nom })).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    ],
    [clientsQ.data],
  );

  const produits = q.data?.produits ?? [];
  const enAttente = q.data?.enAttente ?? [];
  const refusees = q.data?.refusees ?? [];
  const totaux = totauxRecapitulatif(produits);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Récapitulatif des remises" subtitle="Quantités remises aux livreurs et sorties aux clients" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />}
      >
        <FiltrePeriode options={PERIODES_JOURS} valeur={periode} defaut="today" onChange={setPeriode} />
        <View className="gap-3 mt-3">
          <SelectField label="Livreur" value={livreurId} options={optionsLivreurs} onChange={(v) => setLivreurId(v ?? '')} />
          <SelectField label="Commis" value={commisId} options={optionsCommis} onChange={(v) => setCommisId(v ?? '')} />
          <SelectField label="Client" value={clientId} options={optionsClients} onChange={(v) => setClientId(v ?? '')} />
        </View>

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
            <Text className={SECTION}>Par produit</Text>
            {produits.length === 0 ? (
              <EmptyState title="Aucune remise ni sortie." message="Rien n’a été enregistré sur cette période avec ces filtres." />
            ) : (
              <View className="gap-2">
                <View className={`${CARTE} p-3 flex-row justify-between`}>
                  <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-200">Total</Text>
                  <Text accessibilityLabel="Total général" className="text-[12px] font-extrabold text-slate-900 dark:text-white">
                    {`${totaux.remis} remis · ${totaux.sortis} sortis`}
                  </Text>
                </View>
                {produits.map((p) => (
                  <View key={p.produitFournisseurId} className={`${CARTE} p-3`}>
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

            <ListeRemises titre="En attente" aide="Pas encore confirmées par le livreur : hors des totaux." remises={enAttente} />
            <ListeRemises titre="Refusées" aide="Refusées par le livreur : hors des totaux." remises={refusees} />
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
            <View key={r.id} className={`${CARTE} p-3`}>
              <Text className="font-bold text-slate-900 dark:text-white text-[13px]">
                {`${nomPersonne(r.commis)} → ${nomPersonne(r.livreur)} · ${r.commandeNumero}`}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">{`${formatDateShort(r.creeLe)} ${formatTime(r.creeLe)}`}</Text>
              {r.lignes.map((l) => (
                <Text key={l.produitFournisseurId} className="text-[12px] text-slate-700 dark:text-slate-200 mt-0.5">
                  {`${l.quantite} × ${l.designation}`}
                </Text>
              ))}
              {r.motif ? <Text className="text-[12px] text-red-600 dark:text-red-400 mt-1">{r.motif}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
