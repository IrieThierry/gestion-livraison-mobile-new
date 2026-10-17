import { useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Share, Text, View } from 'react-native';
import { KeyRound, Pencil, Plus, Power } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  nomCommis,
  useBasculerCommis,
  useCommisFournisseur,
  useDemandesMotDePasseCommis,
  useIgnorerDemandeCommis,
  useReinitialiserMotDePasseCommis,
} from '../../../../features/fournisseur/commis';
import { BADGE_MOT_DE_PASSE_DEMANDE, demandeEnAttenteDe } from '../../../../features/apprentis/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { naviguer } from '../../../../lib/navigation-app';
import type { CommisResponse } from '../../../../types/api';

/**
 * Moi → Mes commis : les commis de l'entreprise. Création, modification, désactivation et
 * réactivation, réinitialisation du mot de passe (le mot de passe provisoire
 * n'est affiché qu'une fois) et demandes « Mot de passe oublié ».
 */
export default function MesCommis() {
  const q = useCommisFournisseur();
  const demandesQ = useDemandesMotDePasseCommis();
  const basculer = useBasculerCommis();
  const reset = useReinitialiserMotDePasseCommis();
  const ignorer = useIgnorerDemandeCommis();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrouBascule = useRef(creerVerrou()).current;
  const verrouReset = useRef(creerVerrou()).current;
  const verrouIgnorer = useRef(creerVerrou()).current;
  const liste = [...(q.data ?? [])].sort((a, b) => nomCommis(a).localeCompare(nomCommis(b), 'fr'));
  const nb = liste.length;

  const onToggle = (c: CommisResponse) => {
    const suivant = !c.actif;
    const nom = nomCommis(c);
    dialog.confirm({
      title: suivant ? 'Réactiver le compte ?' : 'Désactiver le compte ?',
      message: suivant
        ? `${nom} pourra à nouveau se connecter.`
        : `${nom} ne pourra plus se connecter tant que tu ne réactives pas son compte.`,
      confirmLabel: suivant ? 'Réactiver' : 'Désactiver',
      destructive: !suivant,
      onConfirm: () =>
        lancerUneFois(verrouBascule, (fin) =>
          basculer.mutate(
            { id: c.id, actif: suivant },
            {
              onSettled: fin,
              onError: (e) => dialog.error('Modification impossible', extractApiErrorMessage(e, 'Le compte n’a pas pu être modifié.')),
            },
          ),
        ),
    });
  };

  const onReset = (c: CommisResponse) => {
    const nom = nomCommis(c);
    dialog.confirm({
      title: 'Réinitialiser le mot de passe ?',
      message: `Un mot de passe provisoire sera créé pour ${nom}. L’ancien sera invalidé tout de suite et il devra le changer à sa prochaine connexion.

Pour éviter une fausse demande, appelle-le au numéro de son compte${c.contact ? ` (${c.contact})` : ''} avant de lui donner le mot de passe.`,
      confirmLabel: 'Réinitialiser',
      onConfirm: () =>
        lancerUneFois(verrouReset, (fin) =>
          reset.mutate(c.id, {
            onSettled: fin,
            onSuccess: (r) =>
              dialog.info(
                'Mot de passe provisoire',
                `Communique ce mot de passe à ${nom} :

${r.tempPassword}

Il ne sera plus affiché après la fermeture de cette fenêtre.`,
                {
                  autoDismissMs: 0,
                  actions: [
                    {
                      label: 'Copier',
                      style: 'secondary',
                      onPress: () => {
                        void Share.share({ message: r.tempPassword });
                      },
                    },
                    { label: 'OK', style: 'primary' },
                  ],
                },
              ),
            onError: (e) =>
              dialog.error('Réinitialisation impossible', extractApiErrorMessage(e, 'Le mot de passe n’a pas pu être réinitialisé.')),
          }),
        ),
    });
  };

  const onIgnorer = (c: CommisResponse) => {
    const demande = demandeEnAttenteDe(demandesQ.data, c.id);
    if (!demande) return;
    dialog.confirm({
      title: 'Ignorer la demande ?',
      message: `La demande de mot de passe de ${nomCommis(c)} sera ignorée. Son mot de passe ne change pas.`,
      confirmLabel: 'Ignorer',
      onConfirm: () =>
        lancerUneFois(verrouIgnorer, (fin) =>
          ignorer.mutate(demande.id, {
            onSettled: fin,
            onError: (e) => dialog.error('Action impossible', extractApiErrorMessage(e, 'La demande n’a pas pu être ignorée.')),
          }),
        ),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes commis"
        subtitle={q.isLoading || q.isError ? undefined : `${nb} commis`}
        right={
          <Pressable
            onPress={() => naviguer('/fournisseur/moi/commis/nouveau')}
            accessibilityRole="button"
            accessibilityLabel="Nouveau commis"
            className="bg-emerald-700 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouveau</Text>
          </Pressable>
        }
      />
      <FlatList
        data={liste}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => {
              q.refetch();
              demandesQ.refetch();
            }}
            tintColor="#047857"
          />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#047857" />
            </View>
          ) : q.isError ? (
            <View className="pt-4 px-1 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">{extractApiErrorMessage(q.error, 'Commis indisponibles')}</Text>
              <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <EmptyState
              title="Aucun commis."
              message="Crée un commis pour qu’il remette les produits aux livreurs et aux clients."
            />
          )
        }
        renderItem={({ item }) => (
          <LigneCommis
            commis={item}
            actifReseau={isOnline}
            demande={!!demandeEnAttenteDe(demandesQ.data, item.id)}
            onToggle={() => onToggle(item)}
            onModifier={() => naviguer(`/fournisseur/moi/commis/${item.id}`)}
            onReset={() => onReset(item)}
            onIgnorer={() => onIgnorer(item)}
          />
        )}
      />
    </View>
  );
}

function LigneCommis({
  commis,
  actifReseau,
  demande,
  onToggle,
  onModifier,
  onReset,
  onIgnorer,
}: {
  commis: CommisResponse;
  actifReseau: boolean;
  demande: boolean;
  onToggle: () => void;
  onModifier: () => void;
  onReset: () => void;
  onIgnorer: () => void;
}) {
  const nom = nomCommis(commis);
  const initiales = `${commis.prenom[0] ?? ''}${commis.nom[0] ?? ''}`.toUpperCase();
  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2 flex-row items-center gap-3">
      <View
        className={`w-11 h-11 rounded-full items-center justify-center ${
          commis.actif ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        <Text className={`font-extrabold text-sm ${commis.actif ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
          {initiales || '?'}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-extrabold text-slate-900 dark:text-white">{nom}</Text>
          {!commis.actif ? (
            <View className="bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded">
              <Text className="text-[9px] font-bold text-red-600 dark:text-red-400">DÉSACTIVÉ</Text>
            </View>
          ) : null}
        </View>
        {demande ? (
          <View className="flex-row items-center gap-2 mt-1">
            <View className="flex-row items-center gap-1 bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 rounded">
              <KeyRound color="#b45309" size={10} />
              <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{BADGE_MOT_DE_PASSE_DEMANDE}</Text>
            </View>
            <Pressable
              onPress={onIgnorer}
              disabled={!actifReseau}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Ignorer la demande de ${nom}`}
              className="active:opacity-60"
            >
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 underline">Ignorer</Text>
            </Pressable>
          </View>
        ) : null}
        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {commis.username}
          {commis.contact ? ` · ${commis.contact}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onModifier}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Modifier ${nom}`}
        className="p-2 rounded-md active:opacity-60 bg-slate-100 dark:bg-slate-800"
      >
        <Pencil color="#64748b" size={14} />
      </Pressable>
      <Pressable
        onPress={onReset}
        disabled={!actifReseau}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Réinitialiser le mot de passe de ${nom}`}
        className={`p-2 rounded-md active:opacity-60 ${demande ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-slate-100 dark:bg-slate-800'}`}
      >
        <KeyRound color={demande ? '#b45309' : '#64748b'} size={14} />
      </Pressable>
      <Pressable
        onPress={onToggle}
        disabled={!actifReseau}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${commis.actif ? 'Désactiver' : 'Réactiver'} ${nom}`}
        className={`p-2 rounded-md active:opacity-60 ${commis.actif ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}
      >
        <Power color={commis.actif ? '#dc2626' : '#065f46'} size={14} />
      </Pressable>
    </View>
  );
}
