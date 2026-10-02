import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { dialog } from '../../../../lib/dialog';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  CommandeStatusBadge,
  ReglementBadge,
} from '../../../../components/livreur/CommandeStatusBadge';
import { useAnnulerCommande, useMesCommandes } from '../../../../features/commandes/hooks';
import { peutAnnuler } from '../../../../features/commandes/regles';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatDateLong, formatFCFA } from '../../../../lib/format';

export default function CommandeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useMesCommandes();
  const m = useAnnulerCommande();
  const isOnline = useNetworkStore((s) => s.isOnline);

  const commande = (q.data ?? []).find((c) => c.id === id);

  if (!commande) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Commande" fallback="/(livreur)/cash/commandes" />
        {q.isLoading ? (
          <Text className="text-slate-400 text-sm px-4 pt-4">Chargement…</Text>
        ) : (
          <EmptyState title="Commande introuvable" />
        )}
      </View>
    );
  }

  const onAnnuler = () => {
    dialog.confirm({
      title: 'Annuler cette commande ?',
      message: `${commande.reference} chez ${commande.fournisseur.libelle}. Une commande ne peut être annulée que tant que le fournisseur n'a pas répondu.`,
      confirmLabel: 'Oui, annuler',
      cancelLabel: 'Non, garder',
      destructive: true,
      onConfirm: () =>
        m.mutate(commande.id, {
          onSuccess: () => {
            router.back();
            dialog.success('Commande annulée');
          },
          onError: (err: unknown) =>
            dialog.error('Erreur', extractApiErrorMessage(err, "Impossible d'annuler la commande")),
        }),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={commande.reference}
        subtitle={commande.fournisseur.libelle}
        fallback="/(livreur)/cash/commandes"
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4">
          <View className="flex-row items-center gap-2">
            <CommandeStatusBadge statut={commande.statut} />
            {commande.versementId ? <ReglementBadge /> : null}
          </View>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Passée le {formatDateLong(commande.date)}
            {commande.dateLivraison ? ` · livrée le ${formatDateLong(commande.dateLivraison)}` : ''}
          </Text>

          {commande.motifRefus ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-3 mt-3">
              <Text className="text-red-700 dark:text-red-400 text-[12px]">
                Motif du refus : {commande.motifRefus}
              </Text>
            </View>
          ) : null}

          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Produits
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {commande.produitsCommandes.map((l, i) => (
              <View
                key={l.id}
                className={`px-4 py-3 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
              >
                <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                  {l.produit.designation}
                </Text>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                    Commandée : {l.qteCommandee}
                    {l.qteLivree != null ? ` · Livrée : ${l.qteLivree}` : ''}
                  </Text>
                  {l.prixUnitaire != null && l.qteLivree != null ? (
                    <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                      {formatFCFA(l.prixUnitaire * l.qteLivree)} F
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {commande.montantLivre != null ? (
            <View className="flex-row justify-between mt-3 px-1">
              <Text className="text-slate-700 dark:text-slate-300 font-bold">Total livré</Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                {formatFCFA(commande.montantLivre)} FCFA
              </Text>
            </View>
          ) : null}

          {peutAnnuler(commande) ? (
            <Pressable
              onPress={onAnnuler}
              disabled={m.isPending || !isOnline}
              className={`rounded-md py-3.5 mt-6 items-center ${
                !isOnline ? 'bg-slate-200 dark:bg-slate-800' : 'bg-red-500 active:opacity-80'
              }`}
            >
              {m.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  className={`font-bold text-base ${!isOnline ? 'text-slate-400' : 'text-white'}`}
                >
                  {!isOnline ? 'Hors ligne — réessaye en ligne' : 'Annuler la commande'}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
