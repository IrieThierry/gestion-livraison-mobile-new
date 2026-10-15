import { useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { ActionRemise, RemiseArgentCarte } from '../../../../components/livreur/RemiseArgentCarte';
import { useAnnulerRemise, useMesRemises } from '../../../../features/remises-argent/hooks';
import { peutAnnuler } from '../../../../features/remises-argent/regles';
import { creerVerrou, lancerUneFois } from '../../../../features/commandes/verrou';
import { num } from '../../../../features/encaissements/regles';
import { dialog } from '../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatMontant } from '../../../../lib/format';
import { naviguer } from '../../../../lib/navigation-app';
import type { RemiseArgentResponse } from '../../../../types/api';
import { useAuthStore } from '../../../../stores/authStore';
import { vocabulaire } from '../../../../features/organisation/regles';

/**
 * « Mes remises » (apprenti) : l'argent remis à son principal, la plus
 * récente en premier. Une remise déclarée peut être annulée tant que le
 * principal ne l'a pas confirmée ou contestée. Une remise contestée affiche
 * le motif : l'apprenti en déclare alors une nouvelle.
 */
export default function MesRemises() {
  const q = useMesRemises();
  // O4 : « ton responsable » pour un commercial d'organisation.
  const v = vocabulaire(useAuthStore((s) => s.user));
  const mAnnuler = useAnnulerRemise();
  const verrou = useRef(creerVerrou()).current;
  const remises = q.data ?? [];
  const totalConfirme = useMemo(
    () => remises.filter((r) => r.statut === 'CONFIRMEE').reduce((acc, r) => acc + num(r.montant), 0),
    [remises],
  );

  const onAnnuler = (r: RemiseArgentResponse) =>
    dialog.confirm({
      title: `Annuler la remise ${r.reference} ?`,
      message: `${formatMontant(num(r.montant))} FCFA : la remise ne sera plus proposée à ${v.tonPrincipal}.`,
      confirmLabel: 'Annuler la remise',
      cancelLabel: 'Garder',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mAnnuler.mutate(r.id, {
            onSuccess: () => dialog.success('Remise annulée', r.reference),
            onError: (e) =>
              dialog.error('Annulation impossible', extractApiErrorMessage(e, 'La remise n’a pas pu être annulée.')),
            onSettled: fin,
          }),
        ),
    });

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes remises"
        subtitle={
          q.data
            ? `${remises.length} remise${remises.length > 1 ? 's' : ''} · ${formatMontant(totalConfirme)} FCFA confirmés`
            : undefined
        }
        right={
          <Pressable
            onPress={() => naviguer('/(livreur)/profil/remises/nouvelle')}
            accessibilityRole="button"
            className="bg-emerald-700 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouvelle remise</Text>
          </Pressable>
        }
      />

      <FlatList
        data={q.isError ? [] : remises}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <ActivityIndicator color="#047857" style={{ marginTop: 32 }} />
          ) : q.isError ? (
            <EmptyState title="Chargement impossible" message="Tes remises n’ont pas pu être lues. Tire pour réessayer." />
          ) : (
            <EmptyState
              title="Aucune remise"
              message={`Déclare l’argent remis à ${v.tonPrincipalCourt} avec « Nouvelle remise ».`}
            />
          )
        }
        renderItem={({ item }) => (
          <RemiseArgentCarte
            remise={item}
            actions={
              peutAnnuler(item) ? (
                <ActionRemise
                  libelle="Annuler"
                  icone={<X color="#dc2626" size={14} />}
                  couleur="text-red-600 dark:text-red-400"
                  disabled={mAnnuler.isPending}
                  onPress={() => onAnnuler(item)}
                />
              ) : null
            }
          />
        )}
      />
    </View>
  );
}
