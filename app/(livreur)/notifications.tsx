import { Pressable, Text, View } from 'react-native';
import { EcranNotifications } from '../../components/notifications/EcranNotifications';
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
 * Notifications du responsable (onglet de son espace, O15) : même écran que
 * la cloche du livreur (N8, fil de notifications), avec en « À traiter » ses deux
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
  // S1 : rubrique masquée si vide ou en cours de lecture ; visible si erreur.
  const voirTransferts = transfertsQ.isError || (!transfertsQ.isLoading && transferts.length > 0);
  const voirRemises = remisesQ.isError || (!remisesQ.isLoading && remises.length > 0);

  return (
    <EcranNotifications
      showBack={false}
      onRafraichir={() => {
        transfertsQ.refetch();
        remisesQ.refetch();
      }}
      pied={
        <>
          {decisionTransfert.dialogue}
          {decisionRemise.dialogue}
        </>
      }
      aTraiterVisible={voirTransferts || voirRemises}
      aTraiterEnChargement={transfertsQ.isLoading || remisesQ.isLoading}
      aTraiter={
        <>
          {voirTransferts ? (
            <View className="gap-3">
              <EnTete
                titre="Déchargements à accepter"
                lien="Voir tous les transferts"
                onLien={() => ouvrir('/(livreur)/stock/transferts', { depuis: DEPUIS_NOTIFICATIONS_RESPONSABLE })}
              />
              {transfertsQ.isError ? (
                <EmptyState title="Déchargements indisponibles" message="Les transferts n’ont pas pu être lus." />
              ) : (
                transferts.map((t) => <TransfertCarte key={t.id} transfert={t} actions={decisionTransfert.actions(t)} />)
              )}
            </View>
          ) : null}

          {voirRemises ? (
            <View className="gap-3">
              <EnTete
                titre="Remises à confirmer"
                lien="Voir toutes les remises"
                onLien={() =>
                  ouvrir('/(livreur)/profil/remises-apprentis', { depuis: DEPUIS_NOTIFICATIONS_RESPONSABLE })
                }
              />
              {remisesQ.isError ? (
                <EmptyState title="Remises à confirmer indisponibles" message="Les remises n’ont pas pu être lues." />
              ) : (
                remises.map((r) => (
                  <RemiseArgentCarte key={r.id} remise={r} avecApprenti actions={decisionRemise.actions(r)} />
                ))
              )}
            </View>
          ) : null}
        </>
      }
    />
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
