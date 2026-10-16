import { useRef } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import {
  useAccepterInvitation,
  useInvitationsFournisseur,
  useRefuserInvitation,
} from '../../../features/fournisseur/hooks';
import { nomInvitation } from '../../../features/fournisseur/gestion';
import { creerVerrou, lancerUneFois } from '../../../features/commandes/verrou';
import { useNetworkStore } from '../../../stores/networkStore';
import { dialog } from '../../../lib/dialog';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateLong, formatTime } from '../../../lib/format';
import type { InvitationResponse } from '../../../types/api';

/**
 * F2 : invitations reçues des livreurs (en attente). Accepter est direct ;
 * refuser passe par une confirmation. Une fois acceptée, le livreur lit ton
 * catalogue et te passe commande ; tu peux lui fixer un prix particulier et une remise.
 */
export default function InvitationsFournisseur() {
  const q = useInvitationsFournisseur();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const accepter = useAccepterInvitation();
  const refuser = useRefuserInvitation();
  // Un seul envoi à la fois sur l'écran : un double appui n'envoie qu'une requête.
  const verrou = useRef(creerVerrou()).current;
  const enCours = accepter.isPending || refuser.isPending;
  const actif = isOnline && !enCours;

  const onAccepter = (i: InvitationResponse) =>
    lancerUneFois(verrou, (fin) =>
      accepter.mutate(i.id, {
        onSuccess: () => dialog.success('Invitation acceptée'),
        onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, "Impossible d'accepter l'invitation")),
        onSettled: fin,
      }),
    );

  const onRefuser = (i: InvitationResponse) =>
    dialog.confirm({
      title: `Refuser l'invitation de ${nomInvitation(i)} ?`,
      message: 'Le livreur ne pourra ni lire ton catalogue ni te passer commande. Il pourra t’inviter de nouveau.',
      confirmLabel: 'Oui, refuser',
      cancelLabel: 'Non',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          refuser.mutate(i.id, {
            onSuccess: () => dialog.success('Invitation refusée'),
            onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, "Impossible de refuser l'invitation")),
            onSettled: fin,
          }),
        ),
    });

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Invitations" subtitle="Livreurs qui souhaitent travailler avec toi" />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />
        }
        ListHeaderComponent={
          (q.data?.length ?? 0) > 0 ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              Une fois l’invitation acceptée, le livreur lit ton catalogue et te passe commande ; tu peux lui fixer un
              prix particulier et une remise.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm px-1 pt-4">Chargement…</Text>
          ) : q.isError ? (
            <View className="pt-4 px-1 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">
                {extractApiErrorMessage(q.error, 'Invitations indisponibles')}
              </Text>
              <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <EmptyState title="Aucune invitation en attente." />
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item: i }) => {
          const nom = nomInvitation(i);
          return (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{nom}</Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {i.livreur.contact} · le {formatDateLong(i.dateInvitation)} à {formatTime(i.dateInvitation)}
              </Text>
              <View className="flex-row gap-2 mt-3">
                <Pressable
                  onPress={() => onRefuser(i)}
                  disabled={!actif}
                  accessibilityRole="button"
                  accessibilityLabel={`Refuser l'invitation de ${nom}`}
                  className={`flex-1 rounded-md py-2.5 items-center border ${
                    actif ? 'border-slate-300 dark:border-slate-700 active:opacity-70' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Text className={`font-bold text-[13px] ${actif ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                    Refuser
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onAccepter(i)}
                  disabled={!actif}
                  accessibilityRole="button"
                  accessibilityLabel={`Accepter l'invitation de ${nom}`}
                  className={`flex-1 rounded-md py-2.5 items-center ${
                    actif ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  <Text className={`font-bold text-[13px] ${actif ? 'text-white' : 'text-slate-400'}`}>
                    {isOnline ? 'Accepter' : 'Hors ligne'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
