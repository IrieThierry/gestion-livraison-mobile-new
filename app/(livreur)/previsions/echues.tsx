import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CalendarClock, ChevronRight, Clock, FilePen, Package, Trash2, WifiOff } from 'lucide-react-native';
import { EmptyState } from '../../../components/shared/EmptyState';
import { EcranNotifications } from '../../../components/notifications/EcranNotifications';
import { useDemandesModif } from '../../../features/demandes-modif/hooks';
import { estADecider } from '../../../features/demandes-modif/regles';
import { ChiffresPrevision, PastilleStatut } from '../../../components/previsions/LignePrevision';
import { useCommandesAReceptionner } from '../../../features/commandes/hooks';
import { estMembreOrganisation } from '../../../features/organisation/regles';
import { useRemisesAConfirmer } from '../../../features/remises-argent/hooks';
import { peutDecider } from '../../../features/remises-argent/regles';
import { RemiseArgentCarte, useDecisionRemise } from '../../../components/livreur/RemiseArgentCarte';
import { TransfertCarte, useDecisionTransfert } from '../../../components/livreur/TransfertCarte';
import { useTransfertsADecider } from '../../../features/transferts/hooks';
import { peutDeciderTransfert } from '../../../features/transferts/regles';
import {
  usePlusTard,
  usePrevisionsEchues,
  useReporterGroupes,
  useSupprimerGroupes,
} from '../../../features/previsions/hooks';
import {
  ajouterJours,
  jourAbrege,
  jourCourt,
  jourLocal,
  nomClient,
  type GroupePrevision,
} from '../../../features/previsions/regles';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { DEPUIS_NOTIFICATIONS } from '../../../lib/navigation';
import { dialog } from '../../../lib/dialog';
import { ouvrir } from '../../../lib/navigation-app';
import { extractApiErrorMessage } from '../../../lib/api-error';

/**
 * Cloche de l'Accueil : écran Notifications (N8, `EcranNotifications`) —
 * section « À traiter » ci-dessous, puis le fil de notifications.
 *
 * À traiter : « Commandes à réceptionner » (ouvre la liste) et
 * « Prévisions échues » du livreur connecté (jamais celles des apprentis).
 * Pour chaque échue, ou pour toutes : Supprimer (confirmation), Reporter
 * (aujourd'hui ou demain, pour la quantité restante) ou Plus tard (rien ne
 * change, plus compté jusqu'au lendemain). Jamais de suppression automatique.
 * Principal : « Remises à confirmer » de ses apprentis (Confirmer, Contester).
 * Tous : « Transferts à recevoir » (Accepter, Refuser) et lien vers la liste
 * des transferts (retour à Notifications).
 */
export default function Notifications() {
  const user = useAuthStore((s) => s.user);
  const aujourdhui = jourLocal();
  const demain = ajouterJours(aujourdhui, 1);
  // Organisation : commandes fournisseur fermées, la section est masquée.
  const organisation = estMembreOrganisation(user);
  const qARecep = useCommandesAReceptionner(!!user && !organisation);
  const echuesQ = usePrevisionsEchues(user?.id, aujourdhui);
  const supprimer = useSupprimerGroupes();
  const reporter = useReporterGroupes();
  const plusTard = usePlusTard(user?.id);
  const remisesQ = useRemisesAConfirmer();
  const decision = useDecisionRemise();
  const transfertsQ = useTransfertsADecider();
  const decisionTransfert = useDecisionTransfert(user?.id);
  // N7 : demandes de modification de versement (livreur principal hors organisation).
  const avecDemandesModif = !!user && !user.parentId && !organisation;
  const demandesQ = useDemandesModif(avecDemandesModif);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const enCours = supprimer.isPending || reporter.isPending || plusTard.isPending;
  // Hors ligne : Supprimer / Reporter / Tout traiter désactivés (Plus tard reste local).
  const ecritureImpossible = enCours || !isOnline;

  if (!user) return null;

  const nbCommandes = qARecep.data?.length ?? 0;
  const estPrincipal = !user.parentId;
  const remises = (remisesQ.data ?? []).filter(peutDecider);
  const transferts = (transfertsQ.data ?? []).filter((t) => peutDeciderTransfert(t, user.id));
  const echues = echuesQ.echues;
  const nbDemandes = (demandesQ.data ?? []).filter(estADecider).length;

  const libelleGroupe = (g: GroupePrevision) =>
    `${nomClient(g.client)} — ${g.produit.designation} (prévu ${g.prevu}, livré ${g.livre}, ${jourCourt(g.jour)})`;
  const quoi = (gs: GroupePrevision[]) =>
    gs.length === 1 ? libelleGroupe(gs[0]) : `${gs.length} prévisions échues`;
  const erreur = (titre: string) => (e: unknown) =>
    dialog.error(titre, extractApiErrorMessage(e, 'L’opération a échoué.'));

  const onSupprimer = (gs: GroupePrevision[]) =>
    dialog.confirm({
      title: gs.length === 1 ? 'Supprimer cette prévision échue ?' : `Supprimer ${gs.length} prévisions échues ?`,
      message: `${quoi(gs)}\nLa suppression est définitive.`,
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () =>
        supprimer.mutate(gs, {
          onSuccess: () => dialog.success(gs.length === 1 ? 'Prévision supprimée' : 'Prévisions supprimées'),
          onError: erreur('Suppression impossible'),
        }),
    });

  const lancerReport = (gs: GroupePrevision[], jourCible: string) =>
    reporter.mutate(
      { groupes: gs, jourCible },
      {
        onSuccess: () => dialog.success(`Reporté au ${jourAbrege(jourCible)}`),
        onError: erreur('Report impossible'),
      },
    );

  const onReporter = (gs: GroupePrevision[]) =>
    dialog.info(
      'Reporter la quantité restante',
      `${quoi(gs)}\nReste à livrer reporté sur le jour choisi.`,
      {
        actions: [
          { label: 'Annuler', style: 'secondary' },
          { label: `Aujourd’hui (${jourAbrege(aujourdhui)})`, style: 'primary', onPress: () => lancerReport(gs, aujourdhui) },
          { label: `Demain (${jourAbrege(demain)})`, style: 'primary', onPress: () => lancerReport(gs, demain) },
        ],
      },
    );

  const onPlusTard = (gs: GroupePrevision[]) =>
    plusTard.mutate(
      gs.map((g) => g.cle),
      { onError: erreur('Action impossible') },
    );

  const onToutTraiter = () =>
    dialog.info('Tout traiter', `${echues.length} prévision${echues.length > 1 ? 's' : ''} échue${echues.length > 1 ? 's' : ''}.`, {
      actions: [
        { label: 'Annuler', style: 'secondary' },
        { label: 'Reporter tout', style: 'primary', onPress: () => onReporter(echues) },
        { label: 'Plus tard pour tout', style: 'primary', onPress: () => onPlusTard(echues) },
        { label: 'Supprimer tout', style: 'destructive', onPress: () => onSupprimer(echues) },
      ],
    });

  return (
    <EcranNotifications
      onRafraichir={() => {
        if (!organisation) qARecep.refetch();
        echuesQ.refetch();
        if (estPrincipal) remisesQ.refetch();
        if (avecDemandesModif) demandesQ.refetch();
        transfertsQ.refetch();
      }}
      pied={
        <>
          {decision.dialogue}
          {decisionTransfert.dialogue}
        </>
      }
      aTraiter={
        <>
          {!organisation ? (
          <>
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
            Commandes à réceptionner
          </Text>
          <Pressable
            onPress={() => ouvrir('/(livreur)/cash/commandes/a-receptionner', { depuis: DEPUIS_NOTIFICATIONS })}
            accessibilityRole="button"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex-row items-center gap-3 active:opacity-70"
          >
            <Package color="#f59e0b" size={20} />
            <Text className="flex-1 font-bold text-slate-900 dark:text-white">
              {qARecep.isError
                ? 'Commandes à réceptionner indisponibles'
                : nbCommandes === 0
                ? 'Aucune commande à réceptionner'
                : `${nbCommandes} commande${nbCommandes > 1 ? 's' : ''} à réceptionner`}
            </Text>
            <ChevronRight color="#94a3b8" size={18} />
          </Pressable>
          </>
          ) : null}

          <View className={`flex-row items-center ${organisation ? '' : 'mt-3'}`}>
            <Text className="flex-1 text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Transferts à recevoir
            </Text>
            <Pressable
              onPress={() => ouvrir('/(livreur)/stock/transferts', { depuis: DEPUIS_NOTIFICATIONS })}
              accessibilityRole="button"
              hitSlop={6}
            >
              <Text className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">Voir tous les transferts</Text>
            </Pressable>
          </View>
          {transfertsQ.isLoading ? (
            <ActivityIndicator color="#10b981" />
          ) : transfertsQ.isError ? (
            <EmptyState title="Transferts à recevoir indisponibles" message="Les transferts n’ont pas pu être lus." />
          ) : transferts.length === 0 ? (
            <EmptyState title="Aucun transfert à recevoir" />
          ) : (
            transferts.map((t) => (
              <TransfertCarte key={t.id} transfert={t} actions={decisionTransfert.actions(t)} />
            ))
          )}

          {estPrincipal ? (
            <>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-3">
                Remises à confirmer
              </Text>
              {remisesQ.isLoading ? (
                <ActivityIndicator color="#10b981" />
              ) : remisesQ.isError ? (
                <EmptyState title="Remises à confirmer indisponibles" message="Les remises n’ont pas pu être lues." />
              ) : remises.length === 0 ? (
                <EmptyState title="Aucune remise à confirmer" />
              ) : (
                remises.map((r) => (
                  <RemiseArgentCarte key={r.id} remise={r} avecApprenti actions={decision.actions(r)} />
                ))
              )}
            </>
          ) : null}

          {avecDemandesModif ? (
            <>
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-3">
                Demandes de modification de versement
              </Text>
              <Pressable
                onPress={() => ouvrir('/(livreur)/cash/versements/demandes', { depuis: DEPUIS_NOTIFICATIONS })}
                accessibilityRole="button"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex-row items-center gap-3 active:opacity-70"
              >
                <FilePen color="#7c3aed" size={20} />
                <Text className="flex-1 font-bold text-slate-900 dark:text-white">
                  {demandesQ.isError
                    ? 'Demandes de modification indisponibles'
                    : nbDemandes === 0
                    ? 'Aucune demande de modification à décider'
                    : `${nbDemandes} demande${nbDemandes > 1 ? 's' : ''} de modification à décider`}
                </Text>
                <ChevronRight color="#94a3b8" size={18} />
              </Pressable>
            </>
          ) : null}

          <View className="flex-row items-center mt-3">
            <Text className="flex-1 text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Prévisions échues
            </Text>
            {echues.length > 1 ? (
              <Pressable
                onPress={onToutTraiter}
                disabled={ecritureImpossible}
                accessibilityRole="button"
                className="bg-slate-800 dark:bg-slate-700 px-3 py-1.5 rounded-md active:opacity-80"
              >
                <Text className="text-white text-xs font-bold">Tout traiter</Text>
              </Pressable>
            ) : null}
          </View>
          {!isOnline ? (
            <View className="flex-row items-center gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3">
              <WifiOff color="#d97706" size={14} />
              <Text className="flex-1 text-[12px] text-amber-800 dark:text-amber-200">
                Hors ligne : Supprimer et Reporter seront possibles au retour du réseau.
              </Text>
            </View>
          ) : null}
          {echuesQ.partiel ? (
            <Text className="text-[12px] text-amber-700 dark:text-amber-300">
              Certains jours n’ont pas pu être lus : la liste peut être incomplète.
            </Text>
          ) : null}
          {echuesQ.isLoading ? (
            <ActivityIndicator color="#10b981" />
          ) : echuesQ.isError ? (
            <EmptyState title="Chargement impossible" message="Les prévisions échues n’ont pas pu être lues." />
          ) : echues.length === 0 ? (
            <EmptyState title="Aucune prévision échue" />
          ) : (
            echues.map((g) => (
              <View
                key={g.cle}
                className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 rounded-lg p-3"
              >
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">{nomClient(g.client)}</Text>
                    <Text className="text-[13px] text-slate-700 dark:text-slate-300">{g.produit.designation}</Text>
                    <ChiffresPrevision ligne={g} />
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-[11px] font-bold text-red-600 dark:text-red-400">{jourCourt(g.jour)}</Text>
                    <PastilleStatut statut={g.statut} />
                  </View>
                </View>
                <View className="flex-row gap-2 mt-3">
                  <Action
                    libelle="Supprimer"
                    icone={<Trash2 color="#dc2626" size={14} />}
                    couleur="text-red-600 dark:text-red-400"
                    disabled={ecritureImpossible}
                    onPress={() => onSupprimer([g])}
                  />
                  <Action
                    libelle="Reporter"
                    icone={<CalendarClock color="#2563eb" size={14} />}
                    couleur="text-blue-700 dark:text-blue-300"
                    disabled={ecritureImpossible}
                    onPress={() => onReporter([g])}
                  />
                  <Action
                    libelle="Plus tard"
                    icone={<Clock color="#64748b" size={14} />}
                    couleur="text-slate-600 dark:text-slate-300"
                    disabled={enCours}
                    onPress={() => onPlusTard([g])}
                  />
                </View>
              </View>
            ))
          )}
        </>
      }
    />
  );
}

function Action({
  libelle,
  icone,
  couleur,
  disabled,
  onPress,
}: {
  libelle: string;
  icone: React.ReactNode;
  couleur: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="flex-1 flex-row items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 rounded-md py-2 active:opacity-70"
    >
      {icone}
      <Text className={`text-[12px] font-bold ${couleur}`}>{libelle}</Text>
    </Pressable>
  );
}
