import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { RemiseArgentCarte, useDecisionRemise } from '../../components/livreur/RemiseArgentCarte';
import { TransfertCarte, useDecisionTransfert } from '../../components/livreur/TransfertCarte';
import { useRemisesAConfirmer } from '../../features/remises-argent/hooks';
import { peutDecider } from '../../features/remises-argent/regles';
import { useTransfertsADecider } from '../../features/transferts/hooks';
import { peutDeciderTransfert } from '../../features/transferts/regles';
import { useAuthStore } from '../../stores/authStore';
import { DEPUIS_NOTIFICATIONS_RESPONSABLE } from '../../lib/navigation';
import { ouvrir } from '../../lib/navigation-app';

/**
 * Notifications du responsable (onglet de son espace, O15) : ses deux
 * actions sur le mobile. « Déchargements à accepter » : stock rendu au dépôt
 * par ses commerciaux (Accepter, Refuser avec motif). « Remises à
 * confirmer » : argent déclaré par ses commerciaux (Confirmer, Contester avec
 * motif). Les listes complètes s'ouvrent avec retour ici.
 */
export default function NotificationsResponsable() {
  const user = useAuthStore((s) => s.user);
  const transfertsQ = useTransfertsADecider();
  const remisesQ = useRemisesAConfirmer();
  const decisionTransfert = useDecisionTransfert(user?.id, { annulation: false });
  const decisionRemise = useDecisionRemise();

  if (!user) return null;

  const transferts = (transfertsQ.data ?? []).filter((t) => peutDeciderTransfert(t, user.id));
  const remises = (remisesQ.data ?? []).filter(peutDecider);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Notifications" subtitle="À traiter" showBack={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              transfertsQ.refetch();
              remisesQ.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3 gap-3">
          <EnTete
            titre="Déchargements à accepter"
            lien="Voir tous les transferts"
            onLien={() => ouvrir('/(livreur)/stock/transferts', { depuis: DEPUIS_NOTIFICATIONS_RESPONSABLE })}
          />
          {transfertsQ.isLoading ? (
            <ActivityIndicator color="#10b981" />
          ) : transfertsQ.isError ? (
            <EmptyState title="Déchargements indisponibles" message="Les transferts n’ont pas pu être lus." />
          ) : transferts.length === 0 ? (
            <EmptyState title="Aucun déchargement à accepter" />
          ) : (
            transferts.map((t) => <TransfertCarte key={t.id} transfert={t} actions={decisionTransfert.actions(t)} />)
          )}

          <View className="mt-3">
            <EnTete
              titre="Remises à confirmer"
              lien="Voir toutes les remises"
              onLien={() =>
                ouvrir('/(livreur)/profil/remises-apprentis', { depuis: DEPUIS_NOTIFICATIONS_RESPONSABLE })
              }
            />
          </View>
          {remisesQ.isLoading ? (
            <ActivityIndicator color="#10b981" />
          ) : remisesQ.isError ? (
            <EmptyState title="Remises à confirmer indisponibles" message="Les remises n’ont pas pu être lues." />
          ) : remises.length === 0 ? (
            <EmptyState title="Aucune remise à confirmer" />
          ) : (
            remises.map((r) => (
              <RemiseArgentCarte key={r.id} remise={r} avecApprenti actions={decisionRemise.actions(r)} />
            ))
          )}
        </View>
      </ScrollView>
      {decisionTransfert.dialogue}
      {decisionRemise.dialogue}
    </View>
  );
}

function EnTete({ titre, lien, onLien }: { titre: string; lien: string; onLien: () => void }) {
  return (
    <View className="flex-row items-center">
      <Text className="flex-1 text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
        {titre}
      </Text>
      <Pressable onPress={onLien} accessibilityRole="button" hitSlop={6}>
        <Text className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">{lien}</Text>
      </Pressable>
    </View>
  );
}
