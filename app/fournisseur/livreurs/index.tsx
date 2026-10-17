import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { ChevronRight, ClipboardList, MailOpen } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SearchInput } from '../../../components/shared/SearchInput';
import { useCompteInvitations, useLivreursPartenaires } from '../../../features/fournisseur/hooks';
import { filtrerPartenaires, libelleDu, nomLivreur } from '../../../features/fournisseur/gestion';
import { AUCUN_RESULTAT } from '../../../lib/recherche';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateShort, formatFCFA, formatMontant } from '../../../lib/format';
import { naviguer } from '../../../lib/navigation-app';
import type { LivreurPartenaireDuResponse } from '../../../types/api';

/**
 * F2 : livreurs partenaires (invitation acceptée, bloqués compris) avec leur
 * dû, la remise par unité, la remise à reverser et le dernier versement. Une
 * carte ouvre la fiche du livreur ; « Invitations » ouvre les demandes en attente.
 */
export default function LivreursFournisseur() {
  const q = useLivreursPartenaires();
  const invitationsQ = useCompteInvitations();
  const [recherche, setRecherche] = useState('');
  const visibles = useMemo(() => filtrerPartenaires(q.data, recherche), [q.data, recherche]);
  const nbInvitations = invitationsQ.data ?? 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Livreurs partenaires" subtitle="Ce qu’ils te doivent et la remise à leur reverser" showBack={false} />

      <View className="px-4 gap-2">
        <Pressable
          onPress={() => naviguer('/fournisseur/livreurs/invitations')}
          accessibilityRole="button"
          accessibilityLabel={`Invitations : ${nbInvitations} en attente`}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex-row items-center gap-3 active:opacity-70"
        >
          <View className="w-9 h-9 rounded-full items-center justify-center bg-pink-600">
            <MailOpen color="#ffffff" size={16} />
          </View>
          <View className="flex-1">
            <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">Invitations</Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400">
              Les livreurs qui veulent travailler avec toi
            </Text>
          </View>
          {nbInvitations > 0 ? (
            <View className="bg-red-500 rounded-full px-2 py-0.5">
              <Text className="text-white text-[11px] font-bold">{nbInvitations > 99 ? '99+' : nbInvitations}</Text>
            </View>
          ) : null}
          <ChevronRight color="#94a3b8" size={16} />
        </Pressable>
        <Pressable
          onPress={() => naviguer('/fournisseur/recapitulatif')}
          accessibilityRole="button"
          accessibilityLabel="Récapitulatif des remises"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex-row items-center gap-3 active:opacity-70"
        >
          <View className="w-9 h-9 rounded-full items-center justify-center bg-teal-700">
            <ClipboardList color="#ffffff" size={16} />
          </View>
          <View className="flex-1">
            <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">Récapitulatif des remises</Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400">
              Produits remis et quantités, par livreur
            </Text>
          </View>
          <ChevronRight color="#94a3b8" size={16} />
        </Pressable>
        <SearchInput value={recherche} onChangeText={setRecherche} placeholder="Nom ou contact…" />
      </View>

      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={visibles}
        keyExtractor={(p) => p.livreur.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => {
              q.refetch();
              invitationsQ.refetch();
            }}
            tintColor="#047857"
          />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm px-1 pt-4">Chargement…</Text>
          ) : q.isError ? (
            <View className="pt-4 px-1 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">
                {extractApiErrorMessage(q.error, 'Livreurs partenaires indisponibles')}
              </Text>
              <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : recherche.trim() ? (
            <Text className="text-slate-400 dark:text-slate-500 text-sm text-center pt-6">{AUCUN_RESULTAT}</Text>
          ) : (
            <EmptyState title="Aucun livreur partenaire." message="Accepte une invitation depuis « Invitations »." />
          )
        }
        ListFooterComponent={
          visibles.length > 0 ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
              Dû : total reçu (prix et remise) moins total versé ; une avance est un montant versé en trop. Remise à
              reverser : remise livrée moins remise déjà reversée.
            </Text>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => <CartePartenaire partenaire={item} />}
      />
    </View>
  );
}

function CartePartenaire({ partenaire: p }: { partenaire: LivreurPartenaireDuResponse }) {
  const nom = nomLivreur(p.livreur);
  const du = libelleDu(p.du);
  return (
    <Pressable
      onPress={() => naviguer(`/fournisseur/livreurs/${p.livreur.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Fiche de ${nom}`}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 active:opacity-80"
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2 flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]" numberOfLines={1}>
            {nom}
          </Text>
          {p.bloque ? (
            <View className="bg-red-100 dark:bg-red-500/15 px-2 py-0.5 rounded-full">
              <Text className="text-red-700 dark:text-red-400 text-[10px] font-bold">Bloqué</Text>
            </View>
          ) : null}
        </View>
        <Text
          className={`font-extrabold text-[13px] ${
            du.libelle === 'Avance' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
          }`}
        >
          {du.libelle} {formatFCFA(du.montant)} F
        </Text>
      </View>
      {p.livreur.contact ? (
        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{p.livreur.contact}</Text>
      ) : null}
      <View className="flex-row justify-between mt-1.5">
        <Text className="text-[11px] text-slate-600 dark:text-slate-300">
          Remise / unité : {p.remiseUnitaire ? `${formatMontant(p.remiseUnitaire)} F` : '—'}
        </Text>
        <Text className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
          À reverser : {formatFCFA(p.remiseAReverser)} F
        </Text>
      </View>
      <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
        Dernier versement : {p.dernierVersement ? formatDateShort(p.dernierVersement) : '—'}
      </Text>
    </Pressable>
  );
}
