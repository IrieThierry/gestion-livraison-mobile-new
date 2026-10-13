import { useMemo, useRef } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Plus, XCircle } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { StatutTransfertBadge } from '../../../../components/livreur/StatutTransfertBadge';
import {
  useAnnulerDemandeChargement,
  useMesDemandesChargement,
} from '../../../../features/organisation/hooks';
import { bonsServis, libelleStatutDemande, peutAnnulerDemande } from '../../../../features/organisation/regles';
import { useTransfertsLivreur } from '../../../../features/transferts/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../stores/networkStore';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatDateShort, formatTime } from '../../../../lib/format';
import { naviguer } from '../../../../lib/navigation-app';
import type { DemandeChargementResponse, StatutDemandeChargement } from '../../../../types/api';

const STYLES: Record<StatutDemandeChargement, { bg: string; text: string }> = {
  EN_ATTENTE: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-800 dark:text-amber-400' },
  SERVIE: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  REFUSEE: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400' },
  ANNULEE: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
};

/**
 * « Demandes de chargement » du commercial (O8) : ses demandes, les plus
 * récentes d'abord, avec leur statut, les quantités demandées puis servies et
 * le bon de transfert unique créé au service (référence TRF-n et statut, à
 * accepter dans Transferts). Une
 * demande en attente peut être annulée.
 */
export default function DemandesChargement() {
  const q = useMesDemandesChargement();
  const annuler = useAnnulerDemandeChargement();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const demandes = q.data ?? [];
  // P7 : la référence TRF-n du bon servi se lit dans les transferts du commercial.
  const user = useAuthStore((s) => s.user);
  const transfertsQ = useTransfertsLivreur(user?.id);
  const references = useMemo(
    () => new Map((transfertsQ.data ?? []).map((t) => [t.id, t.reference] as const)),
    [transfertsQ.data],
  );

  const onAnnuler = (d: DemandeChargementResponse) => {
    if (!isOnline) {
      dialog.warning('Hors ligne', 'Reconnecte-toi pour annuler la demande.');
      return;
    }
    dialog.confirm({
      title: `Annuler la demande ${d.reference} ?`,
      message: 'Ton responsable ne pourra plus la servir.',
      confirmLabel: 'Annuler la demande',
      cancelLabel: 'Garder',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          annuler.mutate(d.id, {
            onSuccess: () => dialog.success('Demande annulée'),
            onError: (err) => dialog.error('Annulation impossible', extractApiErrorMessage(err, 'Échec de l’annulation')),
            onSettled: fin,
          }),
        ),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Demandes de chargement"
        subtitle={`${demandes.length} demande${demandes.length > 1 ? 's' : ''}`}
        right={
          <Pressable
            onPress={() => naviguer('/(livreur)/stock/demandes/nouvelle')}
            accessibilityRole="button"
            accessibilityLabel="Nouvelle demande"
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouvelle</Text>
          </Pressable>
        }
      />
      <FlatList
        data={demandes}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#10b981" />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : q.isError ? (
            <EmptyState
              title="Demandes indisponibles"
              message={extractApiErrorMessage(q.error, 'Les demandes de chargement n’ont pas pu être lues.')}
            />
          ) : (
            <EmptyState
              title="Aucune demande de chargement"
              message="Demande du stock au dépôt avec le bouton « Nouvelle »."
            />
          )
        }
        renderItem={({ item }) => (
          <CarteDemande
            demande={item}
            references={references}
            onAnnuler={peutAnnulerDemande(item) ? () => onAnnuler(item) : undefined}
            annulationEnCours={annuler.isPending && annuler.variables === item.id}
          />
        )}
      />
    </View>
  );
}

function CarteDemande({
  demande: d,
  references,
  onAnnuler,
  annulationEnCours,
}: {
  demande: DemandeChargementResponse;
  /** Référence TRF-n de chaque bon, par id (absente tant que les transferts ne sont pas lus). */
  references: ReadonlyMap<string, string>;
  onAnnuler?: () => void;
  annulationEnCours: boolean;
}) {
  const style = STYLES[d.statut] ?? STYLES.ANNULEE;
  const servie = d.statut === 'SERVIE';
  return (
    <View
      accessibilityLabel={`Demande ${d.reference}`}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-extrabold text-slate-900 dark:text-white">{d.reference}</Text>
        <View className={`${style.bg} px-2 py-0.5 rounded-full`}>
          <Text className={`${style.text} text-[10px] font-bold`}>{libelleStatutDemande(d.statut)}</Text>
        </View>
      </View>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        {formatDateShort(d.date)} · {formatTime(d.date)} · {d.quantiteTotaleDemandee} demandé
        {d.quantiteTotaleDemandee > 1 ? 's' : ''}
        {servie && d.quantiteTotaleServie !== null ? ` · ${d.quantiteTotaleServie} servi${d.quantiteTotaleServie > 1 ? 's' : ''}` : ''}
      </Text>
      <View className="mt-2 gap-1">
        {d.lignes.map((l) => (
          <View key={l.produitId} className="flex-row items-center justify-between gap-2">
            <Text className="text-[12px] text-slate-700 dark:text-slate-300 flex-1">{l.designation}</Text>
            <Text className="text-[12px] font-bold text-slate-900 dark:text-white">
              {servie && l.quantiteServie !== null ? `${l.quantiteServie} / ${l.quantiteDemandee}` : l.quantiteDemandee}
            </Text>
          </View>
        ))}
      </View>
      {/* P7 : un seul bon de transfert pour toutes les lignes servies. */}
      {bonsServis(d).map((b) => {
        const ref = references.get(b.transfertId);
        return (
          <View
            key={b.transfertId}
            accessibilityLabel={`Bon de transfert ${ref ?? ''}`.trim()}
            className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-row items-center justify-between gap-2"
          >
            <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300 flex-1">
              {ref ? `Transfert ${ref}` : 'Transfert'}
            </Text>
            <StatutTransfertBadge statut={b.statut} />
          </View>
        );
      })}
      {d.statut === 'REFUSEE' && d.motifRefus ? (
        <Text className="text-[12px] text-red-600 dark:text-red-400 mt-2">Motif : {d.motifRefus}</Text>
      ) : null}
      {servie && d.lignes.some((l) => l.statutTransfert === 'EN_ATTENTE') ? (
        <Text className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
          Accepte le chargement dans Transferts pour l’avoir dans ton stock.
        </Text>
      ) : null}
      {onAnnuler ? (
        <Pressable
          onPress={onAnnuler}
          disabled={annulationEnCours}
          accessibilityRole="button"
          accessibilityLabel={`Annuler la demande ${d.reference}`}
          className="mt-3 self-start flex-row items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-300 dark:border-red-500/40 active:opacity-70"
        >
          {annulationEnCours ? <ActivityIndicator color="#dc2626" size="small" /> : <XCircle color="#dc2626" size={14} />}
          <Text className="text-[12px] font-bold text-red-600 dark:text-red-400">Annuler</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
