import { useRef } from 'react';
import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import {
  useAnnulerInvitation,
  useInviterFournisseur,
  useMesFournisseurs,
} from '../../../features/relations/hooks';
import {
  LIBELLES_ACTION,
  LIBELLES_ETAT,
  MESSAGES_ECHEC,
  MESSAGE_ENTETE_APPRENTI,
  actionPermise,
  afficheDuFournisseur,
  etatRelation,
  libelleDu,
  libelleRemiseARecevoir,
  type ActionRelation,
  type EtatRelation,
} from '../../../features/relations/regles';
import { creerVerrou, lancerUneFois } from '../../../features/commandes/verrou';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { dialog } from '../../../lib/dialog';
import type { FournisseurAvecRelation } from '../../../types/api';

const STYLES_ETAT: Record<EtatRelation, { bg: string; text: string }> = {
  NON_INVITE: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
  ENVOYEE: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-800 dark:text-amber-400' },
  ACCEPTE: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  REFUSE: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400' },
  BLOQUE: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400' },
};

/**
 * « Mes fournisseurs » : annuaire avec l'état de la relation. Le livreur
 * principal invite, annule ou réinvite ; l'apprenti est en lecture seule.
 * Les messages du back sont affichés tels quels.
 */
export default function MesFournisseurs() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const estPrincipal = !!user && !user.parentId;
  const q = useMesFournisseurs();
  const mInviter = useInviterFournisseur();
  const mAnnuler = useAnnulerInvitation();
  const verrou = useRef(creerVerrou()).current;

  const agir = (f: FournisseurAvecRelation, action: ActionRelation) => {
    const lancer = () =>
      lancerUneFois(verrou, (fin) => {
        const options = {
          onSuccess: () =>
            dialog.success(action === 'annuler' ? 'Invitation annulée' : 'Invitation envoyée'),
          onError: (err: unknown) =>
            dialog.error('Erreur', extractApiErrorMessage(err, MESSAGES_ECHEC[action])),
          onSettled: fin,
        };
        if (action === 'annuler' && f.relation) mAnnuler.mutate(f.relation.id, options);
        else mInviter.mutate(f.id, options);
      });
    if (action === 'annuler') {
      dialog.confirm({
        title: `Annuler l'invitation envoyée à ${f.libelle} ?`,
        message: "Le fournisseur ne pourra plus l'accepter. Vous pourrez l'inviter de nouveau.",
        confirmLabel: "Oui, annuler l'invitation",
        cancelLabel: 'Non',
        destructive: true,
        onConfirm: lancer,
      });
    } else {
      lancer();
    }
  };

  if (q.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  const fournisseurs = q.data ?? [];
  const occupe = mInviter.isPending || mAnnuler.isPending;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Mes fournisseurs" fallback="/(livreur)/profil" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
      >
        <View className="px-4 gap-2">
          {!estPrincipal ? (
            <Text className="text-[12px] text-slate-500 dark:text-slate-400 mb-1">
              {MESSAGE_ENTETE_APPRENTI}
            </Text>
          ) : null}
          {q.isError ? (
            <Text className="text-red-500 text-sm">
              {extractApiErrorMessage(q.error, 'Fournisseurs indisponibles')}
            </Text>
          ) : fournisseurs.length === 0 ? (
            <EmptyState title="Aucun fournisseur" />
          ) : (
            fournisseurs.map((f) => {
              const etat = etatRelation(f);
              const action = actionPermise(etat, estPrincipal);
              const style = STYLES_ETAT[etat];
              const montants = afficheDuFournisseur(f, estPrincipal);
              return (
                <View
                  key={f.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                      {f.libelle}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      {f.code}
                      {f.interlocuteur ? ` · ${f.interlocuteur}` : ''}
                      {f.contact ? ` · ${f.contact}` : ''}
                    </Text>
                    <View className={`self-start rounded-full px-2 py-0.5 mt-1 ${style.bg}`}>
                      <Text className={`text-[11px] font-bold ${style.text}`}>
                        {LIBELLES_ETAT[etat]}
                      </Text>
                    </View>
                    {montants && f.du != null ? (
                      <Text
                        className="text-[12px] font-bold text-slate-800 dark:text-slate-200 mt-1"
                        accessibilityLabel={libelleDu(f.du)}
                      >
                        {libelleDu(f.du)}
                      </Text>
                    ) : null}
                    {montants && f.remiseARecevoir != null ? (
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                        {libelleRemiseARecevoir(f.remiseARecevoir)}
                      </Text>
                    ) : null}
                  </View>
                  {montants ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(livreur)/profil/fournisseur-commandes',
                          params: { id: f.id, libelle: f.libelle },
                        } as never)
                      }
                      accessibilityLabel={`Commandes ${f.libelle}`}
                      className="rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700 active:opacity-70"
                    >
                      <Text className="font-bold text-[12px] text-slate-800 dark:text-slate-200">
                        Commandes
                      </Text>
                    </Pressable>
                  ) : null}
                  {action ? (
                    <Pressable
                      onPress={() => agir(f, action)}
                      disabled={occupe || !isOnline}
                      accessibilityLabel={`${LIBELLES_ACTION[action]} ${f.libelle}`}
                      className={`rounded-md px-3 py-2 ${
                        occupe || !isOnline
                          ? 'bg-slate-200 dark:bg-slate-800'
                          : action === 'annuler'
                            ? 'bg-red-500 active:opacity-80'
                            : 'bg-emerald-500 active:opacity-80'
                      }`}
                    >
                      <Text
                        className={`font-bold text-[12px] ${
                          occupe || !isOnline ? 'text-slate-400' : 'text-white'
                        }`}
                      >
                        {LIBELLES_ACTION[action]}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
