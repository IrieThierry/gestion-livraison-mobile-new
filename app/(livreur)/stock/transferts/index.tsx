import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { Plus, Undo2 } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { TransfertCarte, useDecisionTransfert } from '../../../../components/livreur/TransfertCarte';
import { useTransfertsLivreur, useTransfertsParent } from '../../../../features/transferts/hooks';
import { transfertsAffiches, type FiltreTransferts } from '../../../../features/transferts/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { naviguer } from '../../../../lib/navigation-app';
import { estCommercial, estResponsable, vocabulaire } from '../../../../features/organisation/regles';

/**
 * Transferts de stock. Principal : ceux de l'équipe (`GET
 * /transfert-stock/parent/{id}`) ; apprenti : les siens (`GET
 * /transfert-stock/livreur/{id}`). Badge de statut, filtre « En attente » et
 * actions selon le rôle : le décideur Accepte ou Refuse, l'initiateur Annule.
 */
export default function TransfertsList() {
  const user = useAuthStore((s) => s.user);
  const estApprenti = !!user?.parentId;
  const qEquipe = useTransfertsParent(user && !estApprenti ? user.id : undefined);
  const qMiens = useTransfertsLivreur(user && estApprenti ? user.id : undefined);
  const q = estApprenti ? qMiens : qEquipe;
  // Responsable (O15) : sur le mobile, il accepte ou refuse seulement (ni envoi, ni annulation).
  const responsable = estResponsable(user);
  const commercial = estCommercial(user);
  const decision = useDecisionTransfert(user?.id, { annulation: !responsable });
  const [filtre, setFiltre] = useState<FiltreTransferts>('TOUS');

  if (!user) return null;
  const v = vocabulaire(user);

  const tous = q.data ?? [];
  const nbEnAttente = tous.filter((t) => t.statut === 'EN_ATTENTE').length;
  const affiches = transfertsAffiches(tous, filtre);

  const filtres: { id: FiltreTransferts; label: string }[] = [
    { id: 'EN_ATTENTE', label: `En attente (${nbEnAttente})` },
    { id: 'TOUS', label: 'Tous' },
  ];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={commercial ? 'Mes bons de transfert' : 'Transferts de stock'}
        subtitle={`${tous.length} ${commercial ? 'bon' : 'transfert'}${tous.length > 1 ? 's' : ''}`}
        right={
          responsable ? undefined : (
          <Pressable
            onPress={() => naviguer('/(livreur)/stock/transferts/nouveau')}
            accessibilityRole="button"
            className="bg-emerald-700 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            {estApprenti ? <Undo2 color="#fff" size={14} /> : <Plus color="#fff" size={14} />}
            <Text className="text-white text-xs font-bold">{estApprenti ? v.rendreStock : 'Nouveau'}</Text>
          </Pressable>
          )
        }
      />

      <View className="flex-row gap-2 px-4 pt-2">
        {filtres.map((f) => {
          const actif = filtre === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFiltre(f.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: actif }}
              className={`px-3 py-1.5 rounded-full border ${
                actif
                  ? 'bg-emerald-700 border-emerald-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Text className={`text-xs font-bold ${actif ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={affiches}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#047857"
          />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : q.isError ? (
            <EmptyState title="Transferts indisponibles" message="Les transferts n’ont pas pu être lus." />
          ) : filtre === 'EN_ATTENTE' ? (
            <EmptyState title="Aucun transfert en attente" />
          ) : (
            <EmptyState
              title="Aucun transfert"
              message={
                responsable
                  ? undefined
                  : estApprenti
                  ? `Rends du stock à ${v.tonPrincipal} avec « ${v.rendreStock} ».`
                  : `Envoie du stock à un ${v.apprenti}, ou reprends-en, avec le bouton « Nouveau ».`
              }
            />
          )
        }
        renderItem={({ item }) => <TransfertCarte transfert={item} actions={decision.actions(item)} />}
      />
      {decision.dialogue}
    </View>
  );
}
